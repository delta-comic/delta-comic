import { describe, expect, it, vi } from 'vitest'

import {
  CloudflarePluginSandboxLoader,
  DynamicWorkerPluginRunner,
  type PluginSandboxLoader,
  runScheduledPluginScripts,
  ServerPluginScriptRepository,
  ServerPluginScriptService,
  type ScriptRow,
  type ScriptRunRow,
  type ServerPluginScriptRepositoryContract,
} from '../../../../app/modules/plugins/plugins.script'
import { D1Recorder } from '../../d1'

class MemoryScriptRepository implements ServerPluginScriptRepositoryContract {
  installed = new Set(['example.plugin'])
  scripts = new Map<string, ScriptRow>()
  runs: ScriptRunRow[] = []

  async find(pluginId: string) {
    return this.scripts.get(pluginId) ?? null
  }

  async listDue(now: number, limit = 50) {
    return [...this.scripts.values()]
      .filter(row => row.enabled === 1 && row.next_run_at <= now)
      .slice(0, limit)
  }

  async listRuns(pluginId: string, limit = 30) {
    return this.runs
      .filter(row => row.plugin_id === pluginId)
      .slice(-limit)
      .reverse()
  }

  async assertInstalled(pluginId: string) {
    if (!this.installed.has(pluginId)) throw new Error('not installed')
  }

  async save(row: ScriptRow) {
    this.scripts.set(row.plugin_id, { ...row })
  }

  async saveRun(row: ScriptRunRow) {
    this.runs.push({ ...row })
  }

  async advance(pluginId: string, nextRunAt: number, updatedAt: number) {
    const row = this.scripts.get(pluginId)
    if (row) this.scripts.set(pluginId, { ...row, next_run_at: nextRunAt, updated_at: updatedAt })
  }
}

class RecordingSandbox implements PluginSandboxLoader {
  code?: WorkerLoaderWorkerCode
  request?: Request
  result: unknown = { accepted: true }
  error?: unknown
  response?: Response

  async load(code: WorkerLoaderWorkerCode, request: Request) {
    this.code = code
    this.request = request
    if (this.error !== undefined) throw this.error
    return this.response ?? Response.json({ result: this.result })
  }
}

const emptyD1Result: D1Result = {
  meta: {
    changed_db: false,
    changes: 0,
    duration: 0,
    last_row_id: 0,
    rows_read: 0,
    rows_written: 0,
    size_after: 0,
  },
  results: [],
  success: true,
}

const database = {
  all: async () => emptyD1Result,
  batch: async () => [],
  dump: async () => new ArrayBuffer(0),
  exec: async () => ({ count: 0, duration: 0 }),
  first: async () => null,
  raw: async () => [],
  run: async () => emptyD1Result,
}

const createService = () => {
  const repository = new MemoryScriptRepository()
  const sandbox = new RecordingSandbox()
  let now = 1_000
  let id = 0
  return {
    repository,
    sandbox,
    service: new ServerPluginScriptService(
      repository,
      new DynamicWorkerPluginRunner(sandbox, () => database),
      () => ++now,
      () => `run-${++id}`,
    ),
  }
}

describe('server plugin scripts', () => {
  it('configures an installed plugin with a bounded hourly schedule', async () => {
    const { repository, service } = createService()

    const script = await service.save('example.plugin', {
      enabled: true,
      intervalHours: 2,
      nextRunAt: 5_000,
      source: 'return { value: input.value + 1 }',
    })

    expect(script).toMatchObject({
      enabled: true,
      intervalHours: 2,
      nextRunAt: 5_000,
      pluginId: 'example.plugin',
    })
    expect(repository.scripts.get('example.plugin')?.source).toContain('input.value')
  })

  it('preserves creation time and the existing schedule when editing plugin code', async () => {
    const { repository, service } = createService()
    await service.save('example.plugin', {
      enabled: true,
      intervalHours: 2,
      nextRunAt: 5_000,
      source: 'return 1',
    })
    const original = repository.scripts.get('example.plugin')!

    const updated = await service.save('example.plugin', {
      enabled: false,
      intervalHours: 4,
      source: 'return 2',
    })

    expect(updated).toMatchObject({
      createdAt: original.created_at,
      enabled: false,
      intervalHours: 4,
      nextRunAt: 5_000,
      source: 'return 2',
    })
  })

  it('runs code with an isolated loader and persists JSON-safe output', async () => {
    const { repository, sandbox, service } = createService()
    await service.save('example.plugin', {
      enabled: false,
      intervalHours: 1,
      source: 'return { value: input.value + 1 }',
    })

    const result = await service.run('example.plugin', { value: 3 }, 'manual')
    const requestBody = await sandbox.request?.json()

    expect(result).toMatchObject({ result: { accepted: true }, status: 'succeeded' })
    expect(requestBody).toMatchObject({
      context: { pluginId: 'example.plugin', trigger: 'manual' },
      input: { value: 3 },
    })
    expect(sandbox.code).toMatchObject({
      env: { DATABASE: database },
      limits: { cpuMs: 50 },
      mainModule: 'plugin.mjs',
    })
    expect(sandbox.code).not.toHaveProperty('globalOutbound')
    expect(sandbox.code).not.toHaveProperty('limits.subRequests')
    const source = sandbox.code?.modules['plugin.mjs']
    expect(source).toHaveProperty('js')
    expect((source as { js: string }).js).toContain('const database = createDatabase(env.DATABASE)')
    expect((source as { js: string }).js).toContain('const db = database')
    expect(repository.runs).toHaveLength(1)
  })

  it('runs due scripts and advances the next scheduled hour even after a plugin failure', async () => {
    const { repository, sandbox, service } = createService()
    await service.save('example.plugin', {
      enabled: true,
      intervalHours: 3,
      nextRunAt: 2_000,
      source: 'throw new Error("failure")',
    })
    sandbox.error = new Error('sandbox failed')

    await service.runDue(2_000, '0 * * * *')

    expect(repository.runs[0]).toMatchObject({
      error_message: 'sandbox failed',
      status: 'failed',
      trigger: 'scheduled',
    })
    expect(repository.scripts.get('example.plugin')?.next_run_at).toBe(10_802_000)
  })

  it('persists sandbox timeout failures without turning them into successful results', async () => {
    const { repository, sandbox, service } = createService()
    await service.save('example.plugin', {
      enabled: false,
      intervalHours: 1,
      source: 'while (true) {}',
    })
    sandbox.error = new Error('script exceeded CPU time limit')

    const result = await service.run('example.plugin', undefined, 'manual')

    expect(result).toMatchObject({
      errorMessage: 'script exceeded CPU time limit',
      status: 'failed',
    })
    expect(repository.runs[0]).toMatchObject({
      input_json: null,
      result_json: null,
      status: 'failed',
    })
  })

  it('maps non-Error sandbox failures and rejects execution before code is configured', async () => {
    const { sandbox, service } = createService()

    await expect(service.run('missing.plugin', {}, 'manual')).rejects.toMatchObject({
      code: 'PLUGIN_SCRIPT_NOT_FOUND',
      status: 404,
    })

    await service.save('example.plugin', {
      enabled: false,
      intervalHours: 1,
      source: 'return null',
    })
    sandbox.error = 'worker terminated'
    await expect(service.run('example.plugin', {}, 'manual')).resolves.toMatchObject({
      errorMessage: 'worker terminated',
      status: 'failed',
    })
  })

  it('omits undefined output and safely maps malformed persisted history payloads', async () => {
    const { repository, sandbox, service } = createService()
    await service.save('example.plugin', {
      enabled: false,
      intervalHours: 1,
      source: 'return undefined',
    })
    sandbox.result = undefined
    const succeeded = await service.run('example.plugin', undefined, 'manual')
    repository.runs.push({
      completed_at: 20,
      error_message: 'legacy failure',
      id: 'legacy-run',
      input_json: '{invalid',
      plugin_id: 'example.plugin',
      result_json: '{invalid',
      started_at: 10,
      status: 'failed',
      trigger: 'manual',
    })

    const history = await service.listRuns('example.plugin')

    expect(succeeded).not.toHaveProperty('input')
    expect(succeeded).not.toHaveProperty('result')
    expect(repository.runs[0]).toMatchObject({ input_json: null, result_json: null })
    expect(history[0]).toMatchObject({
      errorMessage: 'legacy failure',
      input: undefined,
      result: undefined,
    })
  })
})

describe('DynamicWorkerPluginRunner boundaries', () => {
  const runWithResponse = (response: Response) => {
    const loader: PluginSandboxLoader = { load: vi.fn().mockResolvedValue(response) }
    return new DynamicWorkerPluginRunner(loader, () => database).run(
      { pluginId: 'example.plugin', source: 'return 1' },
      {},
      'manual',
    )
  }

  it('maps non-success sandbox responses to an execution error', async () => {
    await expect(runWithResponse(new Response('timeout', { status: 524 }))).rejects.toThrow(
      'plugin sandbox returned HTTP 524',
    )
  })

  it('rejects oversized and malformed sandbox responses at the trust boundary', async () => {
    await expect(runWithResponse(new Response('x'.repeat(65_537)))).rejects.toThrow(
      'plugin sandbox result exceeds 64 KiB',
    )
    await expect(runWithResponse(new Response('not-json'))).rejects.toThrow(SyntaxError)
  })

  it('returns undefined when a valid sandbox response intentionally omits a result', async () => {
    await expect(runWithResponse(Response.json({}))).resolves.toBeUndefined()
  })

  it('delegates worker-loader execution through the generated entrypoint', async () => {
    const response = Response.json({ result: 1 })
    const fetch = vi.fn().mockResolvedValue(response)
    const getEntrypoint = vi.fn(() => ({ fetch }))
    const load = vi.fn(() => ({ getEntrypoint }))
    const loader = new CloudflarePluginSandboxLoader({ load } as unknown as WorkerLoader)
    const code = { mainModule: 'plugin.mjs', modules: {} } as unknown as WorkerLoaderWorkerCode
    const request = new Request('https://plugin.invalid/run')

    await expect(loader.load(code, request)).resolves.toBe(response)
    expect(load).toHaveBeenCalledWith(code)
    expect(fetch).toHaveBeenCalledWith(request)
  })
})

describe('ServerPluginScriptRepository', () => {
  const scriptRow: ScriptRow = {
    created_at: 1,
    enabled: 1,
    interval_hours: 2,
    next_run_at: 7_200_000,
    plugin_id: 'example.plugin',
    source: 'return 1',
    updated_at: 2,
  }
  const runRow: ScriptRunRow = {
    completed_at: 4,
    error_message: null,
    id: 'run-1',
    input_json: '{}',
    plugin_id: scriptRow.plugin_id,
    result_json: '{"ok":true}',
    started_at: 3,
    status: 'succeeded',
    trigger: 'manual',
  }

  it('reads due code, history, and installation state with bounded queries', async () => {
    const recorder = new D1Recorder()
    recorder.firstResults.push(scriptRow, { plugin_id: scriptRow.plugin_id })
    recorder.allResults.push([scriptRow], [runRow])
    const repository = new ServerPluginScriptRepository(recorder.db)

    await expect(repository.find(scriptRow.plugin_id)).resolves.toEqual(scriptRow)
    await expect(repository.listDue(10_000, 5)).resolves.toEqual([scriptRow])
    await expect(repository.listRuns(scriptRow.plugin_id, 8)).resolves.toEqual([runRow])
    await expect(repository.assertInstalled(scriptRow.plugin_id)).resolves.toBeUndefined()

    expect(recorder.statements[1]?.values).toEqual([10_000, 5])
    expect(recorder.statements[1]?.sql).toContain('enabled = 1 AND next_run_at <= ?')
    expect(recorder.statements[2]?.values).toEqual([scriptRow.plugin_id, 8])
  })

  it('rejects script configuration for an uninstalled plugin', async () => {
    const repository = new ServerPluginScriptRepository(new D1Recorder().db)

    await expect(repository.assertInstalled('missing.plugin')).rejects.toMatchObject({
      code: 'PLUGIN_NOT_INSTALLED',
      status: 409,
    })
  })

  it('persists script definitions, execution records, and schedule advancement exactly', async () => {
    const recorder = new D1Recorder()
    const repository = new ServerPluginScriptRepository(recorder.db)

    await repository.save(scriptRow)
    await repository.saveRun(runRow)
    await repository.advance(scriptRow.plugin_id, 9_000, 5)

    expect(recorder.statements[0]?.values).toEqual([
      scriptRow.plugin_id,
      scriptRow.source,
      scriptRow.enabled,
      scriptRow.interval_hours,
      scriptRow.next_run_at,
      scriptRow.created_at,
      scriptRow.updated_at,
    ])
    expect(recorder.statements[0]?.sql).toContain('ON CONFLICT(plugin_id)')
    expect(recorder.statements[1]?.values).toEqual([
      runRow.id,
      runRow.plugin_id,
      runRow.trigger,
      runRow.status,
      runRow.input_json,
      runRow.result_json,
      runRow.error_message,
      runRow.started_at,
      runRow.completed_at,
    ])
    expect(recorder.statements[2]?.values).toEqual([9_000, 5, scriptRow.plugin_id])
  })

  it('wires the scheduled worker entrypoint to the due-script query', async () => {
    const recorder = new D1Recorder()
    const env = { DB: recorder.db, PLUGIN_LOADER: {} as WorkerLoader }
    const ctx = { exports: { PluginDatabase: vi.fn() } } as unknown as ExecutionContext

    await runScheduledPluginScripts(env, ctx, 42_000, '0 * * * *')

    expect(recorder.statements[0]?.values).toEqual([42_000, 50])
    expect(recorder.statements[0]?.sql).toContain('server_plugin_scripts')
  })
})