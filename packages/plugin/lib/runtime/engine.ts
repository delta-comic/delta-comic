import { markRaw, ref, type App, type Ref } from 'vue'

import type { ConfigEnv } from '../api'
import {
  ActivationPipeline,
  planPluginDependencies,
  PluginScope,
  type CapabilityModule,
  type PluginCandidate,
  type PluginCandidateProvider,
} from '../kernel'

import { PluginStore } from './store'

export interface PluginLoadingInfo {
  progress: {
    errorReason?: string
    status: 'done' | 'error' | 'process' | 'wait'
    stepsIndex: number
  }
  steps: { description: string; name: string }[]
}

export interface PluginRuntimeFailure {
  readonly error: unknown
  readonly phase: 'normal' | 'preboot'
  readonly plugin: string
}

export interface PluginRuntimeReport {
  readonly activated: string[]
  readonly failures: PluginRuntimeFailure[]
}

export interface PluginRuntimeOperation {
  readonly operation: Promise<PluginRuntimeReport>
  readonly progress: Ref<Record<string, PluginLoadingInfo>>
}

export interface LoadNormalOptions {
  readonly pluginNames?: readonly string[]
}

export interface PrebootRecovery {
  failedAt: number
  plugins: string[]
  reason: string
}

export interface PluginRuntimeOptions {
  readonly capabilities: (phase: 'normal' | 'preboot', app?: App) => readonly CapabilityModule[]
  readonly environment: () => ConfigEnv
  readonly provider: PluginCandidateProvider
  readonly remove: (plugin: string) => Promise<void>
  readonly store?: PluginStore
}

const recoveryKey = 'delta-comic:preboot-recovery:v2'

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

const loadingInfo = (): PluginLoadingInfo => ({
  progress: { status: 'wait', stepsIndex: 0 },
  steps: [{ description: '', name: 'waiting' }],
})

export class PluginRuntime {
  readonly #active = new Map<string, { candidate: PluginCandidate; scope: PluginScope }>()
  readonly #options: PluginRuntimeOptions
  #normalOperation?: Promise<PluginRuntimeReport>
  #prebootOperation?: Promise<PluginRuntimeReport>
  #prebootReport?: PluginRuntimeReport

  public readonly store: PluginStore

  public constructor(options: PluginRuntimeOptions) {
    this.#options = options
    this.store = options.store ?? new PluginStore()
  }

  public get activeNormalPluginNames() {
    return [...this.#active]
      .filter(([, value]) => (value.candidate.manifest.kind ?? 'normal') === 'normal')
      .map(([plugin]) => plugin)
  }

  public async preparePreboot(app: App) {
    if (this.#prebootReport) return this.#prebootReport
    if (this.#prebootOperation) return await this.#prebootOperation
    const operation = (async () => {
      const progress = ref<Record<string, PluginLoadingInfo>>({})
      const report = await this.#load('preboot', progress, undefined, app)
      this.#prebootReport = report
      if (report.failures.length > 0) this.#writeRecovery(report.failures)
      return report
    })()
    this.#prebootOperation = operation
    try {
      return await operation
    } finally {
      this.#prebootOperation = undefined
    }
  }

  public loadNormal(options: LoadNormalOptions = {}): PluginRuntimeOperation {
    if (this.#normalOperation) throw new Error('normal plugins are already loading')
    if (this.activeNormalPluginNames.length > 0) {
      throw new Error('normal plugins are already active; use reloadNormal()')
    }
    const progress = ref<Record<string, PluginLoadingInfo>>({})
    const operation = this.#load('normal', progress, options.pluginNames)
    this.#track(operation)
    return { operation, progress }
  }

  public reloadNormal(options: LoadNormalOptions = {}): PluginRuntimeOperation {
    if (this.#normalOperation) throw new Error('normal plugins are already loading')
    const progress = ref<Record<string, PluginLoadingInfo>>({})
    const operation = (async () => {
      await this.#unload(candidate => (candidate.manifest.kind ?? 'normal') === 'normal')
      return await this.#load('normal', progress, options.pluginNames)
    })()
    this.#track(operation)
    return { operation, progress }
  }

  public async uninstall(plugin: string) {
    const candidate = this.store.candidates.get(plugin)
    if (!candidate) throw new Error(`plugin "${plugin}" is not a known candidate`)
    if (!candidate.management.canUninstall) {
      throw new Error(`plugin "${plugin}" cannot be uninstalled`)
    }
    const active = this.#active.get(plugin)
    if (active) await this.#deactivate(plugin, active.scope)
    else {
      const scope = new PluginScope(plugin)
      try {
        const loaded = await candidate.load(scope.signal)
        if (loaded.dispose) scope.defer(loaded.dispose)
        const config = loaded.factory(this.#options.environment())
        await config.hooks?.onUninstall?.()
      } finally {
        await scope.dispose()
      }
    }
    await this.#options.remove(plugin)
    await this.refreshCandidates()
  }

  public async refreshCandidates() {
    const candidates = await this.#options.provider.list(new AbortController().signal)
    this.store.replaceCandidates(candidates)
    return candidates
  }

  public readRecovery(): PrebootRecovery | null {
    try {
      const value = globalThis.localStorage?.getItem(recoveryKey)
      return value ? (JSON.parse(value) as PrebootRecovery) : null
    } catch {
      return null
    }
  }

  public clearRecovery() {
    globalThis.localStorage?.removeItem(recoveryKey)
  }

  async #load(
    phase: 'normal' | 'preboot',
    progress: Ref<Record<string, PluginLoadingInfo>>,
    selected?: readonly string[],
    app?: App,
  ): Promise<PluginRuntimeReport> {
    const candidates = await this.refreshCandidates()
    const activeDependencies = new Set(this.#active.keys())
    const phaseCandidates = candidates
      .filter(candidate => candidate.enabled && (candidate.manifest.kind ?? 'normal') === phase)
      .map(candidate => ({
        ...candidate,
        manifest: {
          ...candidate.manifest,
          require: candidate.manifest.require.filter(value => !activeDependencies.has(value.id)),
        },
      }))
    const chosen = selected
      ? this.#selectWithDependencies(phaseCandidates, selected)
      : phaseCandidates
    const plan = planPluginDependencies(chosen)
    if (plan.missing.length > 0 || plan.cycles.length > 0) {
      const missing = plan.missing.map(value => `${value.plugin} -> ${value.dependency}`).join(', ')
      const cycles = plan.cycles.map(value => value.join(' -> ')).join(', ')
      throw new Error(
        [missing && `missing: ${missing}`, cycles && `cycles: ${cycles}`]
          .filter(Boolean)
          .join('; '),
      )
    }

    const activated: string[] = []
    const failures: PluginRuntimeFailure[] = []
    const failed = new Set<string>()
    for (const level of plan.levels) {
      for (const candidate of level) {
        const plugin = candidate.manifest.name.id
        const info = (progress.value[plugin] = loadingInfo())
        const blockedBy = candidate.manifest.require
          .map(value => value.id)
          .filter(dependency => failed.has(dependency))
        if (blockedBy.length > 0) {
          const error = new Error(`dependency activation failed: ${blockedBy.join(', ')}`)
          info.progress = { errorReason: error.message, status: 'error', stepsIndex: 0 }
          failures.push({ error, phase, plugin })
          failed.add(plugin)
          continue
        }
        const scope = new PluginScope(plugin)
        try {
          info.progress.status = 'process'
          info.steps[0] = { description: '', name: 'module' }
          const loaded = await candidate.load(scope.signal)
          if (loaded.dispose) scope.defer(loaded.dispose)
          const config = markRaw(loaded.factory(this.#options.environment()))
          if (config.name !== plugin)
            throw new Error(`plugin name mismatch: ${plugin} / ${config.name}`)
          this.store.markLoading(plugin, config)
          scope.defer(() => this.store.markUnloaded(plugin))
          const pipeline = new ActivationPipeline(this.#options.capabilities(phase, app))
          await pipeline.activate(config, {
            owner: plugin,
            report: update => {
              const value = typeof update === 'string' ? { description: update } : update
              info.steps[0] = { ...info.steps[0], ...value }
            },
            scope,
            signal: scope.signal,
          })
          this.#active.set(plugin, { candidate, scope })
          this.store.markReady(plugin)
          info.progress.status = 'done'
          activated.push(plugin)
        } catch (error) {
          info.progress = { errorReason: errorText(error), status: 'error', stepsIndex: 0 }
          failures.push({ error, phase, plugin })
          failed.add(plugin)
          await scope.dispose(error).catch(disposeError => {
            failures.push({ error: disposeError, phase, plugin })
          })
        }
      }
    }
    return { activated, failures }
  }

  #selectWithDependencies(candidates: readonly PluginCandidate[], selected: readonly string[]) {
    const byId = new Map(candidates.map(candidate => [candidate.manifest.name.id, candidate]))
    const result = new Map<string, PluginCandidate>()
    const visit = (plugin: string) => {
      const candidate = byId.get(plugin)
      if (!candidate || result.has(plugin)) return
      for (const dependency of candidate.manifest.require) visit(dependency.id)
      result.set(plugin, candidate)
    }
    for (const plugin of selected) visit(plugin)
    return [...result.values()]
  }

  #track(operation: Promise<PluginRuntimeReport>) {
    this.#normalOperation = operation
    void operation.then(
      () => (this.#normalOperation = undefined),
      () => (this.#normalOperation = undefined),
    )
  }

  async #unload(predicate: (candidate: PluginCandidate) => boolean) {
    const targets = [...this.#active].filter(([, value]) => predicate(value.candidate)).reverse()
    const errors: unknown[] = []
    for (const [plugin, value] of targets) {
      try {
        await this.#deactivate(plugin, value.scope)
      } catch (error) {
        errors.push(error)
      }
    }
    if (errors.length > 0) throw new AggregateError(errors, 'some plugins failed to unload')
  }

  async #deactivate(plugin: string, scope: PluginScope) {
    this.#active.delete(plugin)
    await scope.dispose()
  }

  #writeRecovery(failures: readonly PluginRuntimeFailure[]) {
    try {
      globalThis.localStorage?.setItem(
        recoveryKey,
        JSON.stringify({
          failedAt: Date.now(),
          plugins: failures.map(value => value.plugin),
          reason: failures.map(value => errorText(value.error)).join('\n'),
        } satisfies PrebootRecovery),
      )
    } catch {}
  }
}