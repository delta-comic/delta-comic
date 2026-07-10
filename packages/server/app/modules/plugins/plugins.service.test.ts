import { describe, expect, it } from 'vitest'

import { defineServerPlugin } from '../../../lib/plugin'

import { StaticPluginExecutor } from './plugins.executor'
import { ServerPluginService } from './plugins.service'
import type {
  ServerPluginAuditRow,
  ServerPluginInstallationRow,
  ServerPluginJobRow,
  ServerPluginRegistryRow,
  ServerPluginRepositoryContract,
} from './plugins.types'

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

const createService = () => {
  const repository = new MemoryPluginRepository()
  let now = 100
  let id = 0
  const executor = new StaticPluginExecutor([feature, core], {
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
})