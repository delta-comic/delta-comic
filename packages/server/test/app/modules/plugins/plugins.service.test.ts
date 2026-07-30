import { describe, expect, it, vi } from 'vitest'

import { StaticPluginExecutor } from '../../../../app/modules/plugins/plugins.executor'
import { ServerPluginService } from '../../../../app/modules/plugins/plugins.service'
import type {
  ServerPluginAuditRow,
  ServerPluginInstallationRow,
  ServerPluginJobRow,
  ServerPluginRegistryRow,
  ServerPluginRepositoryContract,
} from '../../../../app/modules/plugins/plugins.types'
import {
  defineServerPlugin,
  type ServerPluginDefinition,
  type ServerPluginRuntime,
} from '../../../../lib/plugin'

class MemoryPluginRepository implements ServerPluginRepositoryContract {
  registry = new Map<string, ServerPluginRegistryRow>()
  installations = new Map<string, ServerPluginInstallationRow>()
  jobs = new Map<string, ServerPluginJobRow>()
  audit: ServerPluginAuditRow[] = []

  async listRegistry() {
    return [...this.registry.values()]
  }
  async findRegistry(pluginId: string) {
    return this.registry.get(pluginId) ?? null
  }
  async saveRegistry(row: ServerPluginRegistryRow) {
    this.registry.set(row.plugin_id, { ...row })
  }
  async removeRegistry(pluginId: string) {
    this.registry.delete(pluginId)
  }
  async listInstallations() {
    return [...this.installations.values()]
  }
  async findInstallation(pluginId: string) {
    return this.installations.get(pluginId) ?? null
  }
  async saveInstallation(row: ServerPluginInstallationRow) {
    this.installations.set(row.plugin_id, { ...row })
  }
  async removeInstallation(pluginId: string) {
    this.installations.delete(pluginId)
  }
  async listJobs(limit: number) {
    return [...this.jobs.values()].slice(-limit).reverse()
  }
  async findJob(jobId: string) {
    return this.jobs.get(jobId) ?? null
  }
  async saveJob(row: ServerPluginJobRow) {
    this.jobs.set(row.id, { ...row })
  }
  async listAudit(limit: number) {
    return this.audit.slice(-limit).reverse()
  }
  async saveAudit(row: ServerPluginAuditRow) {
    this.audit.push({ ...row })
  }
}

const core = defineServerPlugin({
  manifest: {
    apiVersion: 1,
    author: 'Delta Comic',
    capabilities: ['health.read'],
    configSchema: { properties: {} },
    dependencies: [],
    description: 'core',
    id: 'core.base',
    name: 'Core',
    version: '1.0.0',
  },
  runtime: {},
})

const feature = defineServerPlugin({
  manifest: {
    apiVersion: 1,
    author: 'Delta Comic',
    capabilities: ['sync.metrics.read'],
    configSchema: {
      properties: { threshold: { defaultValue: 10, label: '阈值', minimum: 1, type: 'number' } },
    },
    dependencies: [{ id: 'core.base', versionRange: '^1.0.0' }],
    description: 'feature',
    id: 'feature.sync',
    name: 'Feature',
    version: '1.0.0',
  },
  runtime: {
    async health({ config, host }) {
      return {
        details: {
          backlog: await host.readMetric('sync.cursorBacklog'),
          threshold: config.threshold ?? null,
        },
        message: 'healthy',
        observedAt: 1_000,
        status: 'healthy',
      }
    },
  },
})

const createDefinition = (
  id: string,
  dependencies: ServerPluginDefinition['manifest']['dependencies'] = [],
  runtime: ServerPluginRuntime = {},
  version = '1.0.0',
): ServerPluginDefinition =>
  defineServerPlugin({
    manifest: {
      apiVersion: 1,
      author: 'Delta Comic',
      capabilities: [],
      configSchema: { properties: {} },
      dependencies,
      description: `${id} test plugin`,
      id,
      name: id,
      version,
    },
    runtime,
  })

const createService = (definitions: Iterable<ServerPluginDefinition> = [feature, core]) => {
  const repository = new MemoryPluginRepository()
  let now = 100
  let id = 0
  const executor = new StaticPluginExecutor(definitions, {
    async probeDatabase() {
      return true
    },
    async readMetric() {
      return 4
    },
  })
  return {
    repository,
    service: new ServerPluginService(
      repository,
      executor,
      () => ++now,
      () => `id-${++id}`,
    ),
  }
}

describe('ServerPluginService', () => {
  it('installs and enables a dependency plan in dependency-first order', async () => {
    const { repository, service } = createService()

    const install = await service.install('feature.sync', 'admin')
    const enable = await service.enable('feature.sync', 'admin')

    expect(install.status).toBe('succeeded')
    expect(enable.status).toBe('succeeded')
    expect([...repository.installations]).toHaveLength(2)
    expect(repository.installations.get('core.base')).toMatchObject({
      desired_state: 'enabled',
      observed_state: 'enabled',
    })
    expect(repository.installations.get('feature.sync')).toMatchObject({
      desired_state: 'enabled',
      observed_state: 'enabled',
    })
    expect(repository.audit.map(item => item.outcome)).toEqual(['succeeded', 'succeeded'])
  })

  it('persists validated config and a real host-backed health result', async () => {
    const { repository, service } = createService()
    await service.install('feature.sync', 'admin')

    const configure = await service.configure('feature.sync', { threshold: 25 }, 'admin')
    const health = await service.health('feature.sync', 'admin')
    const snapshot = await service.snapshot()
    const plugin = snapshot.plugins.find(item => item.manifest.id === 'feature.sync')

    expect(configure.status).toBe('succeeded')
    expect(health.status).toBe('succeeded')
    expect(repository.installations.get('feature.sync')?.config_json).toBe('{"threshold":25}')
    expect(plugin?.lastHealth).toMatchObject({
      details: { backlog: 4, threshold: 25 },
      status: 'healthy',
    })
  })

  it('updates an older persisted installation to the bundled definition version', async () => {
    const { repository, service } = createService()
    await service.install('feature.sync', 'admin')
    const installation = repository.installations.get('feature.sync')!
    repository.installations.set('feature.sync', { ...installation, installed_version: '0.9.0' })

    const update = await service.update('feature.sync', 'admin')

    expect(update).toMatchObject({
      result: { changed: true, previousVersion: '0.9.0', version: '1.0.0' },
      status: 'succeeded',
    })
    expect(repository.installations.get('feature.sync')).toMatchObject({
      installed_version: '1.0.0',
      observed_state: 'disabled',
    })
  })

  it('blocks dependency mutations without corrupting the current runtime state', async () => {
    const { repository, service } = createService()
    await service.install('feature.sync', 'admin')
    await service.enable('feature.sync', 'admin')

    const disable = await service.disable('core.base', 'admin')
    const uninstall = await service.uninstall('core.base', 'admin')

    expect(disable).toMatchObject({ status: 'failed' })
    expect(disable.errorMessage).toMatch(/dependent plugins/)
    expect(uninstall).toMatchObject({ status: 'failed' })
    expect(repository.installations.get('core.base')).toMatchObject({
      desired_state: 'enabled',
      last_error: null,
      observed_state: 'enabled',
    })
  })

  it('records the authenticated actor on register jobs and exposes jobs by id', async () => {
    const { repository, service } = createService()

    const job = await service.register('core.base', 'admin-user-42')

    expect(job).toMatchObject({
      action: 'register',
      result: { version: '1.0.0' },
      status: 'succeeded',
    })
    await expect(service.findJob(job.id)).resolves.toEqual(job)
    expect(repository.audit).toContainEqual(
      expect.objectContaining({
        actor_id: 'admin-user-42',
        detail_json: '{"version":"1.0.0"}',
        outcome: 'succeeded',
      }),
    )
    await expect(service.findJob('missing-job')).rejects.toMatchObject({
      code: 'PLUGIN_JOB_NOT_FOUND',
      status: 404,
    })
  })

  it('auto-installs on enable, skips an already-running runtime, and disables it cleanly', async () => {
    const start = vi.fn()
    const stop = vi.fn()
    const definition = createDefinition('runtime.lifecycle', [], { start, stop })
    const { repository, service } = createService([definition])

    await service.enable(definition.manifest.id, 'admin')
    await service.enable(definition.manifest.id, 'admin')
    const disabled = await service.disable(definition.manifest.id, 'admin')

    expect(start).toHaveBeenCalledTimes(1)
    expect(stop).toHaveBeenCalledTimes(1)
    expect(disabled).toMatchObject({
      result: { disabled: definition.manifest.id },
      status: 'succeeded',
    })
    expect(repository.installations.get(definition.manifest.id)).toMatchObject({
      desired_state: 'disabled',
      observed_state: 'disabled',
    })
  })

  it('restarts enabled plugins on update and returns a no-op for the current version', async () => {
    const start = vi.fn()
    const stop = vi.fn()
    const update = vi.fn()
    const definition = createDefinition('runtime.update', [], { start, stop, update }, '2.0.0')
    const { repository, service } = createService([definition])
    await service.install(definition.manifest.id, 'admin')
    await service.enable(definition.manifest.id, 'admin')
    const installation = repository.installations.get(definition.manifest.id)!
    repository.installations.set(definition.manifest.id, {
      ...installation,
      installed_version: '1.5.0',
    })

    const changed = await service.update(definition.manifest.id, 'admin')
    const unchanged = await service.update(definition.manifest.id, 'admin')

    expect(changed).toMatchObject({
      result: { changed: true, previousVersion: '1.5.0', version: '2.0.0' },
      status: 'succeeded',
    })
    expect(unchanged).toMatchObject({ result: { changed: false, version: '2.0.0' } })
    expect(stop).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(expect.anything(), '1.5.0')
    expect(start).toHaveBeenCalledTimes(2)
  })

  it('rolls an enabled plugin back to its previous config when restart fails', async () => {
    const start = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('new config rejected'))
      .mockResolvedValueOnce(undefined)
    const stop = vi.fn()
    const definition = defineServerPlugin({
      manifest: {
        ...createDefinition('runtime.config').manifest,
        configSchema: {
          properties: {
            threshold: { defaultValue: 10, label: '阈值', minimum: 1, type: 'number' },
          },
        },
      },
      runtime: { start, stop },
    })
    const { repository, service } = createService([definition])
    await service.enable(definition.manifest.id, 'admin')

    const job = await service.configure(definition.manifest.id, { threshold: 20 }, 'admin')

    expect(job).toMatchObject({ errorMessage: 'new config rejected', status: 'failed' })
    expect(stop).toHaveBeenCalledWith(expect.objectContaining({ config: { threshold: 10 } }))
    expect(start).toHaveBeenLastCalledWith(expect.objectContaining({ config: { threshold: 10 } }))
    expect(repository.installations.get(definition.manifest.id)?.config_json).toBe(
      '{"threshold":10}',
    )
  })

  it('maps runtime failures to failed state while preserving client-rejected state', async () => {
    const definition = createDefinition('runtime.failure', [], {
      start() {
        throw new Error('runtime start failed')
      },
    })
    const { repository, service } = createService([definition])
    await service.install(definition.manifest.id, 'admin')

    const runtimeFailure = await service.enable(definition.manifest.id, 'admin')
    const rejected = await service.enable('missing.plugin', 'admin')

    expect(runtimeFailure).toMatchObject({ errorMessage: 'runtime start failed', status: 'failed' })
    expect(repository.installations.get(definition.manifest.id)).toMatchObject({
      last_error: 'runtime start failed',
      observed_state: 'failed',
    })
    expect(rejected).toMatchObject({ status: 'failed' })
    expect(repository.installations.has('missing.plugin')).toBe(false)
    expect(repository.audit.at(-1)).toMatchObject({
      actor_id: 'admin',
      detail_json: expect.stringContaining('required server plugin definition is missing'),
      outcome: 'failed',
    })
  })

  it('rejects missing, incompatible, and cyclic dependency graphs as client errors', async () => {
    const missing = createDefinition('graph.missing', [{ id: 'dependency.absent' }])
    const oldCore = createDefinition('graph.core', [], {}, '1.0.0')
    const incompatible = createDefinition('graph.incompatible', [
      { id: oldCore.manifest.id, versionRange: '^2.0.0' },
    ])
    const cycleA = createDefinition('graph.cycle-a', [{ id: 'graph.cycle-b' }])
    const cycleB = createDefinition('graph.cycle-b', [{ id: 'graph.cycle-a' }])
    const { repository, service } = createService([missing, oldCore, incompatible, cycleA, cycleB])

    const jobs = await Promise.all([
      service.install(missing.manifest.id, 'admin'),
      service.install(incompatible.manifest.id, 'admin'),
      service.install(cycleA.manifest.id, 'admin'),
    ])

    expect(jobs.map(job => job.errorMessage)).toEqual([
      expect.stringContaining('is missing'),
      expect.stringContaining('does not satisfy'),
      expect.stringContaining('dependency cycle'),
    ])
    expect(repository.installations).toHaveLength(0)
  })

  it('persists unavailable health and removes enabled plugins through runtime hooks', async () => {
    const stop = vi.fn()
    const uninstall = vi.fn()
    const definition = createDefinition('runtime.health', [], {
      health() {
        throw new Error('health probe timed out')
      },
      stop,
      uninstall,
    })
    const { repository, service } = createService([definition])
    await service.enable(definition.manifest.id, 'admin')

    const health = await service.health(definition.manifest.id, 'admin')
    const installationAfterHealth = repository.installations.get(definition.manifest.id)
    const removed = await service.uninstall(definition.manifest.id, 'admin')

    expect(health).toMatchObject({ errorMessage: 'health probe timed out', status: 'failed' })
    expect(installationAfterHealth).toMatchObject({
      last_error: 'health probe timed out',
      last_health_json: expect.stringContaining('"status":"unavailable"'),
    })
    expect(removed).toMatchObject({ status: 'succeeded' })
    expect(stop).toHaveBeenCalledTimes(1)
    expect(uninstall).toHaveBeenCalledTimes(1)
    expect(repository.installations.has(definition.manifest.id)).toBe(false)
    expect(repository.registry.has(definition.manifest.id)).toBe(false)
  })

  it('maps orphaned registry data and malformed persisted JSON into a safe snapshot', async () => {
    const { repository, service } = createService([])
    const orphan = createDefinition('orphan.plugin').manifest
    repository.registry.set(orphan.id, {
      manifest_json: JSON.stringify(orphan),
      plugin_id: orphan.id,
      registered_at: 1,
      source: 'static',
      trusted: 1,
      updated_at: 2,
    })
    repository.installations.set(orphan.id, {
      config_json: '{invalid',
      desired_state: 'disabled',
      installed_at: 3,
      installed_version: '0.9.0',
      last_error: null,
      last_health_at: 4,
      last_health_json: '{invalid',
      observed_state: 'disabled',
      plugin_id: orphan.id,
      updated_at: 5,
    })
    repository.jobs.set('old-job', {
      action: 'health',
      completed_at: 8,
      created_at: 6,
      error_message: null,
      id: 'old-job',
      plugin_id: orphan.id,
      result_json: '{invalid',
      started_at: 7,
      status: 'succeeded',
      updated_at: 8,
    })
    repository.audit.push({
      action: 'health',
      actor_id: 'admin',
      created_at: 9,
      detail_json: '{invalid',
      id: 'old-audit',
      job_id: 'old-job',
      outcome: 'succeeded',
      plugin_id: orphan.id,
    })

    const snapshot = await service.snapshot()

    expect(snapshot.plugins[0]).toMatchObject({
      allowedActions: ['configure', 'health', 'uninstall'],
      config: {},
      lastError: 'static plugin definition is unavailable',
      lastHealth: { message: 'invalid stored health payload', status: 'unavailable' },
      observedState: 'failed',
      registered: true,
    })
    expect(snapshot.recentJobs[0]?.result).toEqual({})
    expect(snapshot.recentAudit[0]?.detail).toEqual({})
  })

  it('derives allowed actions from available, registered, installed, outdated, and enabled states', async () => {
    const { repository, service } = createService([core])

    const available = (await service.snapshot()).plugins[0]
    await service.register(core.manifest.id, 'admin')
    const registered = (await service.snapshot()).plugins[0]
    await service.install(core.manifest.id, 'admin')
    const installed = (await service.snapshot()).plugins[0]
    const installation = repository.installations.get(core.manifest.id)!
    repository.installations.set(core.manifest.id, {
      ...installation,
      installed_version: '0.5.0',
      last_error: 'previous failure',
      last_health_at: null,
      last_health_json: '{invalid',
    })
    const outdated = (await service.snapshot()).plugins[0]
    await service.enable(core.manifest.id, 'admin')
    const enabled = (await service.snapshot()).plugins[0]

    expect(available).toMatchObject({ allowedActions: ['register'], observedState: 'available' })
    expect(registered).toMatchObject({ allowedActions: ['install'], observedState: 'registered' })
    expect(installed).toMatchObject({
      allowedActions: ['configure', 'health', 'uninstall', 'enable'],
      observedState: 'installed',
    })
    expect(outdated).toMatchObject({
      allowedActions: ['configure', 'health', 'uninstall', 'enable', 'update'],
      lastError: 'previous failure',
      lastHealth: { observedAt: expect.any(Number), status: 'unavailable' },
      updateAvailable: true,
    })
    expect(enabled?.allowedActions).toContain('disable')
  })

  it('keeps rejected definition and installation operations as failed jobs with no runtime damage', async () => {
    const install = vi.fn().mockRejectedValue(new Error('install hook failed'))
    const broken = createDefinition('runtime.install-failure', [], { install })
    const { repository, service } = createService([core, broken])

    const missingDefinition = await service.register('missing.plugin', 'admin')
    const missingInstallation = await service.configure(core.manifest.id, {}, 'admin')
    const failedInstall = await service.install(broken.manifest.id, 'admin')
    await service.install(core.manifest.id, 'admin')
    const repeatInstall = await service.install(core.manifest.id, 'admin')
    const alreadyDisabled = await service.disable(core.manifest.id, 'admin')

    expect(missingDefinition).toMatchObject({ status: 'failed' })
    expect(missingInstallation).toMatchObject({ status: 'failed' })
    expect(failedInstall).toMatchObject({ errorMessage: 'install hook failed', status: 'failed' })
    expect(repeatInstall).toMatchObject({ result: { installed: [core.manifest.id] } })
    expect(alreadyDisabled).toMatchObject({ status: 'succeeded' })
    expect(repository.installations.has(broken.manifest.id)).toBe(false)
    expect(repository.installations.get(core.manifest.id)).toMatchObject({
      desired_state: 'disabled',
      observed_state: 'disabled',
    })
  })

  it('stores unavailable health returned by a runtime without treating it as an exception', async () => {
    const definition = createDefinition('runtime.degraded-health', [], {
      health: () => ({ message: 'upstream unavailable', observedAt: 9_000, status: 'unavailable' }),
    })
    const { repository, service } = createService([definition])
    await service.install(definition.manifest.id, 'admin')

    const job = await service.health(definition.manifest.id, 'admin')

    expect(job).toMatchObject({
      result: { health: { message: 'upstream unavailable', status: 'unavailable' } },
      status: 'succeeded',
    })
    expect(repository.installations.get(definition.manifest.id)).toMatchObject({
      last_error: 'upstream unavailable',
      last_health_at: 9_000,
    })
  })

  it('uninstalls persisted orphan records even when the static definition is gone', async () => {
    const { repository, service } = createService([])
    repository.installations.set('orphan.plugin', {
      config_json: '{}',
      desired_state: 'disabled',
      installed_at: 1,
      installed_version: '1.0.0',
      last_error: null,
      last_health_at: null,
      last_health_json: null,
      observed_state: 'disabled',
      plugin_id: 'orphan.plugin',
      updated_at: 2,
    })

    const job = await service.uninstall('orphan.plugin', 'admin')

    expect(job).toMatchObject({ result: { uninstalled: 'orphan.plugin' }, status: 'succeeded' })
    expect(repository.installations.has('orphan.plugin')).toBe(false)
  })
})