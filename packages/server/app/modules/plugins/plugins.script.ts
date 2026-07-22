import { logger } from '@delta-comic/logger'

import { all, first, run } from '@/infrastructure/d1/database'
import { AppError } from '@/shared/errors'

import type {
  ServerPluginScript,
  ServerPluginScriptRun,
  ServerPluginScriptTrigger,
} from '../../../lib/plugin'

import type { PluginDatabaseBinding } from './plugins.database'

const scriptLogger = logger.scoped('server:plugins:scripts')

export interface ScriptRow {
  plugin_id: string
  source: string
  enabled: number
  interval_hours: number
  next_run_at: number
  created_at: number
  updated_at: number
}

export interface ScriptRunRow {
  id: string
  plugin_id: string
  trigger: ServerPluginScriptTrigger
  status: 'failed' | 'succeeded'
  input_json: string | null
  result_json: string | null
  error_message: string | null
  started_at: number
  completed_at: number
}

export interface SavePluginScriptInput {
  enabled: boolean
  intervalHours: number
  nextRunAt?: number
  source: string
}

export interface ServerPluginScriptRepositoryContract {
  find(pluginId: string): Promise<ScriptRow | null>
  listDue(now: number, limit?: number): Promise<ScriptRow[]>
  listRuns(pluginId: string, limit?: number): Promise<ScriptRunRow[]>
  assertInstalled(pluginId: string): Promise<void>
  save(row: ScriptRow): Promise<void>
  saveRun(row: ScriptRunRow): Promise<void>
  advance(pluginId: string, nextRunAt: number, updatedAt: number): Promise<void>
}

export interface PluginSandboxLoader {
  load(code: WorkerLoaderWorkerCode, request: Request): Promise<Response>
}

const parseJson = (value: string | null): unknown => {
  if (value === null) return undefined
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

const toScript = (row: ScriptRow): ServerPluginScript => ({
  createdAt: row.created_at,
  enabled: row.enabled === 1,
  intervalHours: row.interval_hours,
  nextRunAt: row.next_run_at,
  pluginId: row.plugin_id,
  source: row.source,
  updatedAt: row.updated_at,
})

const toScriptRun = (row: ScriptRunRow): ServerPluginScriptRun => ({
  completedAt: row.completed_at,
  ...(row.error_message ? { errorMessage: row.error_message } : {}),
  id: row.id,
  ...(row.input_json === null ? {} : { input: parseJson(row.input_json) }),
  pluginId: row.plugin_id,
  ...(row.result_json === null ? {} : { result: parseJson(row.result_json) }),
  startedAt: row.started_at,
  status: row.status,
  trigger: row.trigger,
})

export class ServerPluginScriptRepository implements ServerPluginScriptRepositoryContract {
  constructor(private readonly db: D1Database) {}

  async find(pluginId: string): Promise<ScriptRow | null> {
    return await first<ScriptRow>(
      this.db,
      'SELECT * FROM server_plugin_scripts WHERE plugin_id = ? LIMIT 1',
      pluginId,
    )
  }

  async listDue(now: number, limit = 50): Promise<ScriptRow[]> {
    return await all<ScriptRow>(
      this.db,
      `SELECT * FROM server_plugin_scripts
       WHERE enabled = 1 AND next_run_at <= ?
       ORDER BY next_run_at ASC LIMIT ?`,
      now,
      limit,
    )
  }

  async listRuns(pluginId: string, limit = 30): Promise<ScriptRunRow[]> {
    return await all<ScriptRunRow>(
      this.db,
      `SELECT * FROM server_plugin_script_runs
       WHERE plugin_id = ? ORDER BY started_at DESC, id DESC LIMIT ?`,
      pluginId,
      limit,
    )
  }

  async assertInstalled(pluginId: string): Promise<void> {
    const installation = await first<{ plugin_id: string }>(
      this.db,
      'SELECT plugin_id FROM server_plugin_installations WHERE plugin_id = ? LIMIT 1',
      pluginId,
    )
    if (!installation) {
      throw new AppError('PLUGIN_NOT_INSTALLED', 'install the plugin before configuring code', 409)
    }
  }

  async save(row: ScriptRow): Promise<void> {
    await run(
      this.db,
      `INSERT INTO server_plugin_scripts
       (plugin_id, source, enabled, interval_hours, next_run_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(plugin_id) DO UPDATE SET
         source = excluded.source,
         enabled = excluded.enabled,
         interval_hours = excluded.interval_hours,
         next_run_at = excluded.next_run_at,
         updated_at = excluded.updated_at`,
      row.plugin_id,
      row.source,
      row.enabled,
      row.interval_hours,
      row.next_run_at,
      row.created_at,
      row.updated_at,
    )
  }

  async saveRun(row: ScriptRunRow): Promise<void> {
    await run(
      this.db,
      `INSERT INTO server_plugin_script_runs
       (id, plugin_id, trigger, status, input_json, result_json, error_message, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.plugin_id,
      row.trigger,
      row.status,
      row.input_json,
      row.result_json,
      row.error_message,
      row.started_at,
      row.completed_at,
    )
  }

  async advance(pluginId: string, nextRunAt: number, updatedAt: number): Promise<void> {
    await run(
      this.db,
      'UPDATE server_plugin_scripts SET next_run_at = ?, updated_at = ? WHERE plugin_id = ?',
      nextRunAt,
      updatedAt,
      pluginId,
    )
  }
}

export class CloudflarePluginSandboxLoader implements PluginSandboxLoader {
  constructor(private readonly loader: WorkerLoader) {}

  async load(code: WorkerLoaderWorkerCode, request: Request): Promise<Response> {
    return await this.loader.load(code).getEntrypoint().fetch(request)
  }
}

export class DynamicWorkerPluginRunner {
  constructor(
    private readonly loader: PluginSandboxLoader,
    private readonly database: () => PluginDatabaseBinding,
  ) {}

  async run(
    script: Pick<ServerPluginScript, 'pluginId' | 'source'>,
    input: unknown,
    trigger: ServerPluginScriptTrigger,
    scheduledTime?: number,
  ): Promise<unknown> {
    const mainModule = 'plugin.mjs'
    const source = `
const createDatabase = binding => {
  const states = new WeakMap()
  const prepare = (query, values = []) => {
    const statement = Object.freeze({
      all: () => binding.all(query, values),
      bind: (...nextValues) => prepare(query, nextValues),
      first: columnName => binding.first(query, values, columnName),
      raw: options => binding.raw(query, values, options),
      run: () => binding.run(query, values),
    })
    states.set(statement, { query, values })
    return statement
  }
  return Object.freeze({
    batch: statements => binding.batch(statements.map(statement => {
      const state = states.get(statement)
      if (!state) throw new TypeError('database.batch only accepts prepared statements')
      return state
    })),
    dump: () => binding.dump(),
    exec: query => binding.exec(query),
    prepare,
  })
}

export default {
  async fetch(request, env) {
    const payload = await request.json()
    const input = payload.input
    const context = Object.freeze(payload.context)
    const database = createDatabase(env.DATABASE)
    const db = database
    const execute = async () => {
${script.source}
    }
    const result = await execute()
    return Response.json({ result })
  }
}`
    const code: WorkerLoaderWorkerCode = {
      compatibilityDate: '2026-07-02',
      env: { DATABASE: this.database() },
      limits: { cpuMs: 50 },
      mainModule,
      modules: { [mainModule]: { js: source } },
    }
    const response = await this.loader.load(
      code,
      new Request('https://plugin.invalid/run', {
        body: JSON.stringify({
          context: { pluginId: script.pluginId, scheduledTime: scheduledTime ?? null, trigger },
          input,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    )
    if (!response.ok) throw new Error(`plugin sandbox returned HTTP ${response.status}`)
    const text = await response.text()
    if (text.length > 65_536) throw new Error('plugin sandbox result exceeds 64 KiB')
    const payload = JSON.parse(text) as { result?: unknown }
    return payload.result
  }
}

export class ServerPluginScriptService {
  constructor(
    private readonly repository: ServerPluginScriptRepositoryContract,
    private readonly runner: DynamicWorkerPluginRunner,
    private readonly now: () => number = Date.now,
    private readonly randomId: () => string = () => crypto.randomUUID(),
  ) {}

  async find(pluginId: string): Promise<ServerPluginScript | null> {
    const row = await this.repository.find(pluginId)
    return row ? toScript(row) : null
  }

  async save(pluginId: string, input: SavePluginScriptInput): Promise<ServerPluginScript> {
    await this.repository.assertInstalled(pluginId)
    const now = this.now()
    const existing = await this.repository.find(pluginId)
    await this.repository.save({
      created_at: existing?.created_at ?? now,
      enabled: input.enabled ? 1 : 0,
      interval_hours: input.intervalHours,
      next_run_at:
        input.nextRunAt ?? existing?.next_run_at ?? now + input.intervalHours * 3_600_000,
      plugin_id: pluginId,
      source: input.source,
      updated_at: now,
    })
    scriptLogger.info('plugin script configuration saved', {
      enabled: input.enabled,
      intervalHours: input.intervalHours,
      pluginId,
    })
    return (await this.find(pluginId))!
  }

  async listRuns(pluginId: string): Promise<ServerPluginScriptRun[]> {
    return (await this.repository.listRuns(pluginId)).map(toScriptRun)
  }

  async run(
    pluginId: string,
    input: unknown,
    trigger: ServerPluginScriptTrigger,
    scheduledTime?: number,
  ) {
    const row = await this.repository.find(pluginId)
    if (!row) throw new AppError('PLUGIN_SCRIPT_NOT_FOUND', 'plugin code is not configured', 404)
    const startedAt = this.now()
    scriptLogger.debug('plugin script run started', { pluginId, trigger })
    try {
      const result = await this.runner.run(toScript(row), input, trigger, scheduledTime)
      const completedAt = this.now()
      const runRow: ScriptRunRow = {
        completed_at: completedAt,
        error_message: null,
        id: this.randomId(),
        input_json: input === undefined ? null : JSON.stringify(input),
        plugin_id: pluginId,
        result_json: result === undefined ? null : JSON.stringify(result),
        started_at: startedAt,
        status: 'succeeded',
        trigger,
      }
      await this.repository.saveRun(runRow)
      scriptLogger.debug('plugin script run completed', {
        durationMs: completedAt - startedAt,
        pluginId,
        trigger,
      })
      return toScriptRun(runRow)
    } catch (error) {
      const completedAt = this.now()
      const runRow: ScriptRunRow = {
        completed_at: completedAt,
        error_message: error instanceof Error ? error.message : String(error),
        id: this.randomId(),
        input_json: input === undefined ? null : JSON.stringify(input),
        plugin_id: pluginId,
        result_json: null,
        started_at: startedAt,
        status: 'failed',
        trigger,
      }
      await this.repository.saveRun(runRow)
      scriptLogger.error('plugin script run failed', {
        durationMs: completedAt - startedAt,
        error,
        pluginId,
        trigger,
      })
      return toScriptRun(runRow)
    }
  }

  async runDue(scheduledTime: number, cron: string): Promise<void> {
    const scripts = await this.repository.listDue(scheduledTime)
    if (scripts.length > 0) {
      scriptLogger.info('scheduled plugin script batch started', { count: scripts.length, cron })
    } else {
      scriptLogger.debug('scheduled plugin script batch has no due work', { cron })
    }
    await Promise.all(
      scripts.map(async row => {
        await this.run(row.plugin_id, { cron }, 'scheduled', scheduledTime)
        const nextRunAt = scheduledTime + row.interval_hours * 3_600_000
        await this.repository.advance(row.plugin_id, nextRunAt, this.now())
      }),
    )
    if (scripts.length > 0) {
      scriptLogger.info('scheduled plugin script batch completed', { count: scripts.length, cron })
    }
  }
}

export const createPluginScriptService = (
  env: Pick<Env, 'DB' | 'PLUGIN_LOADER'>,
  ctx: ExecutionContext,
) =>
  new ServerPluginScriptService(
    new ServerPluginScriptRepository(env.DB),
    new DynamicWorkerPluginRunner(new CloudflarePluginSandboxLoader(env.PLUGIN_LOADER), () =>
      ctx.exports.PluginDatabase({}),
    ),
  )

export const runScheduledPluginScripts = (
  env: Pick<Env, 'DB' | 'PLUGIN_LOADER'>,
  ctx: ExecutionContext,
  scheduledTime: number,
  cron: string,
) => createPluginScriptService(env, ctx).runDue(scheduledTime, cron)