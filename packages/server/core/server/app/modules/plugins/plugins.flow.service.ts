import { DiagnosticRecorder } from '@delta-comic/both'
import { parsePluginManifest } from '@delta-comic/plugin-manifest'
import { Context } from 'cordis'

import { AppError } from '@/shared/errors'

import { parseFlowDocument, type FlowInstallation, type FlowRun } from '../../../lib/flow'

import { createFlowHttp, executeFlow, FlowExecutionError } from './plugins.flow'
import { claimDueFlows, FlowRepository } from './plugins.flow.repository'

export interface FlowInstallInput {
  manifest: unknown
  source: string
  enabled: boolean
  config: Record<string, unknown>
  schedule?: FlowInstallation['schedule']
}

interface FlowBudget {
  queries: number
  http: number
}

export class FlowService {
  readonly repository: FlowRepository
  constructor(
    db: D1Database,
    readonly tenantId: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.repository = new FlowRepository(db, tenantId)
  }

  async install(pluginId: string, input: FlowInstallInput): Promise<FlowInstallation> {
    const manifest = parsePluginManifest(input.manifest)
    if (manifest.id !== pluginId || !manifest.server)
      throw new TypeError('server manifest ID and entry are required')
    const document = parseFlowDocument(JSON.parse(input.source))
    const resource = manifest.resources.find(item => item.path === manifest.server?.entry)
    if (!resource) throw new TypeError('server flow resource is required')
    const digest = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.source)),
    )
    const integrity = `sha256-${btoa(String.fromCharCode(...digest))}`
    if (resource.integrity !== integrity)
      throw new TypeError('server flow resource integrity mismatch')
    if (
      input.schedule &&
      (!document.flows.some(flow => flow.id === input.schedule?.flowId) ||
        !Number.isInteger(input.schedule.intervalHours) ||
        input.schedule.intervalHours < 1 ||
        input.schedule.intervalHours > 168)
    )
      throw new TypeError('invalid flow schedule')
    const installation: FlowInstallation = {
      manifest,
      document,
      config: input.config,
      enabled: input.enabled,
      schedule: input.schedule,
    }
    await this.repository.save(pluginId, installation)
    return installation
  }

  async configure(
    pluginId: string,
    config: Record<string, unknown>,
    enabled: boolean,
    schedule?: FlowInstallation['schedule'],
  ) {
    const installation = await this.require(pluginId)
    if (
      schedule &&
      (!installation.document.flows.some(flow => flow.id === schedule.flowId) ||
        !Number.isInteger(schedule.intervalHours) ||
        schedule.intervalHours < 1 ||
        schedule.intervalHours > 168)
    )
      throw new TypeError('invalid flow schedule')
    await this.repository.save(pluginId, { ...installation, config, enabled, schedule })
    return await this.require(pluginId)
  }

  private async require(pluginId: string): Promise<FlowInstallation> {
    const installation = await this.repository.find(pluginId)
    if (!installation)
      throw new AppError('PLUGIN_NOT_INSTALLED', 'plugin installation not found', 404)
    return installation
  }

  async run(
    pluginId: string,
    flowId: string,
    input: unknown,
    trigger: FlowRun['trigger'] = 'manual',
    signal = new AbortController().signal,
    budget: FlowBudget = { queries: 47, http: 16 },
  ): Promise<FlowRun | Response> {
    // Reserve the installation reads and both run writes; HTTP auth uses three D1 queries.
    if (budget.queries < 4) throw new Error('flow D1 query limit exceeded')
    budget.queries -= 4
    const installation = await this.require(pluginId)
    if (!installation.enabled) throw new AppError('PLUGIN_DISABLED', 'plugin is disabled', 409)
    const flow = installation.document.flows.find(flow => flow.id === flowId)
    if (!flow) throw new AppError('FLOW_NOT_FOUND', 'flow not found', 404)
    const context = new Context()
    const diagnostics = new DiagnosticRecorder({ source: 'server-flow', pluginId })
    context.logger.exporter({
      export: message => {
        diagnostics.record(message.type, 'flow lifecycle', { messages: message.args.map(String) })
      },
    })
    const controller = new AbortController()
    const executionSignal = AbortSignal.any([signal, controller.signal])
    const run: FlowRun = {
      id: crypto.randomUUID(),
      tenantId: this.tenantId,
      pluginId,
      flowId,
      trigger,
      status: 'running',
      input,
      startedAt: Date.now(),
      metrics: { steps: 0, http: 0, durationMs: 0 },
    }
    const started = performance.now()
    let finished: Promise<void> | undefined
    const finish = (error?: unknown) =>
      (finished ??= (async () => {
        controller.abort()
        try {
          await context.fiber.dispose()
        } catch (cleanupError) {
          diagnostics.record('error', 'flow cleanup failed', { error: String(cleanupError) })
        }
        run.status = error === undefined ? 'succeeded' : 'failed'
        if (error !== undefined) {
          run.error = error instanceof Error ? error.message : String(error)
          if (error instanceof FlowExecutionError) run.stepId = error.stepId
        }
        run.completedAt = Date.now()
        run.metrics.durationMs = performance.now() - started
        await this.repository.saveRun(run)
      })())
    try {
      await this.repository.saveRun(run)
      context.provide('identity', { tenantId: this.tenantId, pluginId })
      context.provide('input', input ?? null)
      context.provide('flowConfig', installation.config)
      const store = this.repository.store(pluginId)
      const consumeQuery = () => {
        if (budget.queries <= 0) throw new Error('flow D1 query limit exceeded')
        budget.queries--
      }
      context.provide('store', {
        get: key => {
          consumeQuery()
          return store.get(key)
        },
        set: (key, value) => {
          consumeQuery()
          return store.set(key, value)
        },
        delete: key => {
          consumeQuery()
          return store.delete(key)
        },
      })
      const http = createFlowHttp(executionSignal, this.fetcher)
      context.provide('http', async input => {
        if (budget.http <= 0) throw new Error('flow HTTP limit exceeded')
        budget.http--
        const result = await http(input)
        if (result instanceof Response && result.body) {
          const body = result.body
          context.effect(() => async () => {
            if (!body.locked) await body.cancel()
          })
        }
        return result
      })
      context.provide('diagnostics', diagnostics)
      let output: unknown
      await context
        .plugin(
          Object.assign(
            async function flowExecution(ctx: Context) {
              output = await executeFlow(ctx, flow.steps, run.metrics, executionSignal)
            },
            { inject: ['identity', 'input', 'flowConfig', 'store', 'http', 'diagnostics'] },
          ),
        )
        .await()
      if (output instanceof Response && output.body) {
        const reader = output.body.getReader()
        const abort = () => {
          const completion = finish(signal.reason ?? new Error('flow request cancelled'))
          void reader
            .cancel(signal.reason)
            .then(() => completion)
            .catch(error => {
              diagnostics.record('error', 'flow response cleanup failed', { error: String(error) })
            })
        }
        context.effect(() => {
          signal.addEventListener('abort', abort, { once: true })
          return () => signal.removeEventListener('abort', abort)
        })
        if (signal.aborted) abort()
        const headers = new Headers(output.headers)
        headers.set('x-flow-run-id', run.id)
        const body = new ReadableStream<Uint8Array>({
          async pull(stream) {
            try {
              const item = await reader.read()
              if (item.done) {
                await finish()
                stream.close()
              } else stream.enqueue(item.value)
            } catch (error) {
              await finish(error)
              stream.error(error)
            }
          },
          async cancel(reason) {
            const completion = finish(new Error('flow response cancelled'))
            try {
              await reader.cancel(reason)
            } finally {
              await completion
            }
          },
        })
        return new Response(body, { status: output.status, statusText: output.statusText, headers })
      }
      run.result = output instanceof Response ? { status: output.status } : output
      await finish()
    } catch (error) {
      await finish(error)
    }
    return run
  }
}

export const runScheduledFlows = async (db: D1Database, now: number): Promise<void> => {
  const budget: FlowBudget = { queries: 50, http: 50 }
  while (budget.queries >= 5 && budget.http >= 16) {
    budget.queries--
    const [schedule] = await claimDueFlows(db, now, 1)
    if (!schedule) return
    try {
      const result = await new FlowService(db, schedule.tenant_id).run(
        schedule.plugin_id,
        schedule.flow_id,
        null,
        'scheduled',
        new AbortController().signal,
        budget,
      )
      if (result instanceof Response) await result.body?.cancel()
    } catch (error) {
      console.error('scheduled flow failed', schedule.tenant_id, schedule.plugin_id, error)
    }
  }
}