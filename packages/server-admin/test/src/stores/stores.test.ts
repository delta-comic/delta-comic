import type {
  ServerPluginJob,
  ServerPluginScript,
  ServerPluginScriptRun,
  ServerPluginSnapshot,
} from '@delta-comic/server'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AdminApiClient } from '@/shared/api/AdminApiClient'
import type { AdminCapabilities, AdminOverview } from '@/shared/api/types'

import { useConnectionStore } from '../../../src/stores/connection'
import { useOverviewStore } from '../../../src/stores/overview'
import { usePluginsStore } from '../../../src/stores/plugins'

const capabilities = {
  features: {
    adminAuthentication: true,
    databaseMetrics: true,
    databaseReadiness: true,
    pluginAudit: true,
    versionMetadata: true,
  },
  modules: [],
  observedAt: 1,
  server: {
    adminPath: '/api/admin',
    bindings: {},
    configuration: {
      accessTokenTtlSeconds: 1,
      refreshTokenTtlSeconds: 1,
      syncMaxPullChanges: 1,
      syncMaxPushOps: 1,
    },
    requiredSecrets: {},
    service: 'delta-comic',
  },
} satisfies AdminCapabilities

const overview = {
  deployment: { available: true, id: 'deployment-1', tag: 'v1', timestamp: 'now' },
  health: {
    checkedAt: 1,
    database: { status: 'ready' },
    issues: [],
    ready: true,
    requiredSecrets: {},
    status: 'ready',
  },
  metrics: [],
  observedAt: 1,
  recentActivity: { available: true, items: [] },
} satisfies AdminOverview

const pluginSnapshot = (ids = ['installed', 'available']): ServerPluginSnapshot => ({
  observedAt: 1,
  plan: { cycles: [], levels: [ids], missing: [] },
  plugins: ids.map((id, index) => ({
    allowedActions: index === 0 ? ['configure', 'enable', 'uninstall'] : ['install'],
    config: {},
    desiredState: index === 0 ? 'disabled' : 'uninstalled',
    installedVersion: index === 0 ? '1.0.0' : undefined,
    manifest: {
      apiVersion: 1,
      author: 'Delta',
      capabilities: [],
      configSchema: { properties: {} },
      dependencies: [],
      description: `${id} plugin`,
      id,
      name: id,
      version: '1.0.0',
    },
    observedState: index === 0 ? 'disabled' : 'available',
    registered: index === 0,
    updateAvailable: false,
  })),
  recentAudit: [],
  recentJobs: [],
})

const succeededJob = (action: ServerPluginJob['action']): ServerPluginJob => ({
  action,
  createdAt: 1,
  id: `job-${action}`,
  pluginId: 'installed',
  status: 'succeeded',
  updatedAt: 2,
})

const script: ServerPluginScript = {
  createdAt: 1,
  enabled: true,
  intervalHours: 2,
  nextRunAt: 3,
  pluginId: 'installed',
  source: 'return input',
  updatedAt: 2,
}

const scriptRun: ServerPluginScriptRun = {
  completedAt: 2,
  id: 'run-1',
  pluginId: 'installed',
  result: { ok: true },
  startedAt: 1,
  status: 'succeeded',
  trigger: 'manual',
}

const memoryStorage = (): Storage => {
  const data = new Map<string, string>()
  return {
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => [...data.keys()][index] ?? null,
    get length() {
      return data.size
    },
    removeItem: key => data.delete(key),
    setItem: (key, value) => data.set(key, String(value)),
  }
}

const resetBrowserStorage = () => {
  Object.defineProperties(window, {
    localStorage: { configurable: true, value: memoryStorage() },
    sessionStorage: { configurable: true, value: memoryStorage() },
  })
}

describe('connection store', () => {
  beforeEach(() => {
    resetBrowserStorage()
    setActivePinia(createPinia())
  })

  it('persists normalized credentials and clears session state', () => {
    const store = useConnectionStore()
    store.status = 'connected'
    store.capabilities = capabilities

    store.saveCredentials(' https://server.example/api/ ', ' token ')

    expect(store.apiBaseUrl).toBe('https://server.example')
    expect(store.adminToken).toBe('token')
    expect(store.hasCredentials).toBe(true)
    expect(store.status).toBe('disconnected')
    expect(store.capabilities).toBeNull()
    expect(window.localStorage.getItem('delta-comic.server-admin.endpoint')).toBe(
      'https://server.example',
    )
    expect(window.sessionStorage.getItem('delta-comic.server-admin.token')).toBe('token')

    store.clearToken()
    expect(store.adminToken).toBe('')
    expect(store.hasCredentials).toBe(false)
    expect(window.sessionStorage.getItem('delta-comic.server-admin.token')).toBeNull()
  })

  it('hydrates browser credentials and rejects client creation without an endpoint', () => {
    window.localStorage.setItem('delta-comic.server-admin.endpoint', 'https://stored.example/api')
    window.sessionStorage.setItem('delta-comic.server-admin.token', 'stored-token')
    const hydrated = useConnectionStore()
    expect(hydrated.apiBaseUrl).toBe('https://stored.example')
    expect(hydrated.adminToken).toBe('stored-token')

    setActivePinia(createPinia())
    window.localStorage.clear()
    const empty = useConnectionStore()
    expect(() => empty.createClient()).toThrow('请先配置 Server API 地址')
    expect(() => empty.saveCredentials('ftp://server.example', 'token')).toThrow(/http/)
  })

  it('short-circuits missing credentials and connects with capabilities', async () => {
    const store = useConnectionStore()
    await expect(store.connect()).resolves.toBe(false)
    expect(store.error).toContain('请先在设置中')

    store.saveCredentials('https://server.example', 'token')
    const get = vi.spyOn(AdminApiClient.prototype, 'get').mockResolvedValue(capabilities)
    await expect(store.connect()).resolves.toBe(true)

    expect(get).toHaveBeenCalledWith('/api/admin/capabilities')
    expect(store.status).toBe('connected')
    expect(store.isConnected).toBe(true)
    expect(store.capabilities).toEqual(capabilities)
  })

  it('turns API failures into readable connection state', async () => {
    const store = useConnectionStore()
    store.saveCredentials('https://server.example', 'token')
    vi.spyOn(AdminApiClient.prototype, 'get').mockRejectedValue(new Error('offline'))

    await expect(store.connect()).resolves.toBe(false)
    expect(store.status).toBe('error')
    expect(store.error).toBe('offline')
    expect(store.capabilities).toBeNull()
  })
})

describe('overview store', () => {
  beforeEach(() => {
    resetBrowserStorage()
    setActivePinia(createPinia())
  })

  it('requires credentials before loading', async () => {
    const store = useOverviewStore()
    await store.load()
    expect(store.error).toBe('请先配置服务器连接')
    expect(store.loading).toBe(false)
  })

  it('loads overview data and always releases loading state', async () => {
    const connection = useConnectionStore()
    connection.saveCredentials('https://server.example', 'token')
    const get = vi.fn().mockResolvedValue(overview)
    vi.spyOn(connection, 'createClient').mockReturnValue({ get } as unknown as AdminApiClient)
    const store = useOverviewStore()

    await store.load()
    expect(get).toHaveBeenCalledWith('/api/admin/overview')
    expect(store.data).toEqual(overview)
    expect(store.error).toBe('')
    expect(store.loading).toBe(false)

    get.mockRejectedValueOnce(new Error('overview unavailable'))
    await store.load()
    expect(store.error).toBe('overview unavailable')
    expect(store.loading).toBe(false)
  })
})

describe('plugins store', () => {
  beforeEach(() => {
    resetBrowserStorage()
    setActivePinia(createPinia())
  })

  const setupClient = () => {
    const connection = useConnectionStore()
    connection.saveCredentials('https://server.example', 'token')
    const client = { delete: vi.fn(), get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn() }
    vi.spyOn(connection, 'createClient').mockReturnValue(client as unknown as AdminApiClient)
    return { client, connection, store: usePluginsStore() }
  }

  it('loads, categorizes, selects, and clears a missing selection', async () => {
    const { client, store } = setupClient()
    client.get.mockResolvedValueOnce(pluginSnapshot())
    await store.load()

    expect(store.installed.map(item => item.manifest.id)).toEqual(['installed'])
    expect(store.available.map(item => item.manifest.id)).toEqual(['available'])
    store.select('installed')
    expect(store.selected?.manifest.id).toBe('installed')

    client.get.mockResolvedValueOnce(pluginSnapshot(['available']))
    await store.load()
    expect(store.selectedId).toBe('')
    expect(store.loading).toBe(false)
  })

  it('requires credentials and reports load failures', async () => {
    const disconnected = usePluginsStore()
    await disconnected.load()
    expect(disconnected.error).toBe('请先配置服务器连接')

    setActivePinia(createPinia())
    const { client, store } = setupClient()
    client.get.mockRejectedValue(new Error('snapshot failed'))
    await store.load()
    expect(store.error).toBe('snapshot failed')
    expect(store.loading).toBe(false)
  })

  it.each([
    ['configure', 'patch', '/api/admin/plugins/installed/config', { config: { port: 8080 } }],
    ['uninstall', 'delete', '/api/admin/plugins/installed', undefined],
    ['enable', 'post', '/api/admin/plugins/installed/enable', undefined],
  ] as const)(
    'dispatches %s through the correct API method',
    async (action, method, path, body) => {
      const { client, store } = setupClient()
      client[method].mockResolvedValue(succeededJob(action))
      client.get.mockResolvedValue(pluginSnapshot())

      const result = await store.runAction(
        'installed',
        action,
        action === 'configure' ? { port: 8080 } : undefined,
      )

      expect(client[method]).toHaveBeenCalledWith(path, ...(body === undefined ? [] : [body]))
      expect(result?.status).toBe('succeeded')
      expect(store.pending).toEqual({})
      expect(client.get).toHaveBeenCalledWith('/api/admin/plugins')
    },
  )

  it('retains failed job details and normalizes thrown action errors', async () => {
    const { client, store } = setupClient()
    client.post.mockResolvedValue({
      ...succeededJob('enable'),
      errorMessage: 'runtime refused',
      status: 'failed',
    })
    client.get.mockResolvedValue(pluginSnapshot())
    await store.runAction('installed', 'enable')
    expect(store.error).toBe('runtime refused')

    client.post.mockRejectedValueOnce(new Error('action offline'))
    await expect(store.runAction('installed', 'enable')).resolves.toBeUndefined()
    expect(store.error).toBe('action offline')
    expect(store.pending).toEqual({})
  })

  it('skips a duplicate action while one is pending for the same plugin', async () => {
    const { client, store } = setupClient()
    const pendingPost = Promise.withResolvers<ServerPluginJob>()
    client.post.mockReturnValue(pendingPost.promise)
    client.get.mockResolvedValue(pluginSnapshot())

    const first = store.runAction('installed', 'enable')
    const second = await store.runAction('installed', 'disable')
    expect(second).toBeUndefined()
    expect(store.pending['installed']).toBe('enable')

    pendingPost.resolve(succeededJob('enable'))
    await first
    expect(client.post).toHaveBeenCalledOnce()
    expect(store.pending).toEqual({})
  })

  it('loads script state and run history together', async () => {
    const { client, store } = setupClient()
    client.get.mockResolvedValueOnce(script).mockResolvedValueOnce([scriptRun])

    await store.loadScript('plugin/id')

    expect(client.get).toHaveBeenNthCalledWith(1, '/api/admin/plugins/plugin%2Fid/script')
    expect(client.get).toHaveBeenNthCalledWith(2, '/api/admin/plugins/plugin%2Fid/script/runs')
    expect(store.script).toEqual(script)
    expect(store.scriptRuns).toEqual([scriptRun])
    expect(store.scriptPending).toBe(false)
  })

  it('saves and runs scripts, refreshing the derived script state', async () => {
    const { client, store } = setupClient()
    client.put.mockResolvedValue(script)
    client.post.mockResolvedValue(scriptRun)
    client.get.mockResolvedValueOnce(script).mockResolvedValueOnce([scriptRun])

    await expect(
      store.saveScript('installed', { enabled: true, intervalHours: 2, source: 'return input' }),
    ).resolves.toBe(true)
    expect(client.put).toHaveBeenCalledWith('/api/admin/plugins/installed/script', {
      enabled: true,
      intervalHours: 2,
      source: 'return input',
    })

    client.get.mockResolvedValueOnce(script).mockResolvedValueOnce([scriptRun])
    await expect(store.runScript('installed', { comicId: 1 })).resolves.toEqual(scriptRun)
    expect(client.post).toHaveBeenCalledWith('/api/admin/plugins/installed/script/run', {
      input: { comicId: 1 },
    })
    expect(store.scriptPending).toBe(false)
  })

  it('reports script load, save, and execution failures', async () => {
    const { client, store } = setupClient()
    client.get.mockRejectedValue(new Error('script load failed'))
    await store.loadScript('installed')
    expect(store.error).toBe('script load failed')

    client.put.mockRejectedValue(new Error('script save failed'))
    await expect(
      store.saveScript('installed', { enabled: false, intervalHours: 1, source: '' }),
    ).resolves.toBe(false)
    expect(store.error).toBe('script save failed')

    client.post.mockRejectedValue(new Error('script run failed'))
    await expect(store.runScript('installed', null)).resolves.toBeNull()
    expect(store.error).toBe('script run failed')
    expect(store.scriptPending).toBe(false)
  })
})