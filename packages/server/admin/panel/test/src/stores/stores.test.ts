import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AdminApiClient } from '@/shared/api/AdminApiClient'
import type { AdminCapabilities, AdminOverview } from '@/shared/api/types'

import { useConnectionStore } from '../../../src/stores/connection'
import { useOverviewStore } from '../../../src/stores/overview'

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

    store.saveCredentials(' https://example.com/api/ ', ' token ')

    expect(store.apiBaseUrl).toBe('https://example.com')
    expect(store.adminToken).toBe('token')
    expect(store.hasCredentials).toBe(true)
    expect(store.status).toBe('disconnected')
    expect(store.capabilities).toBeNull()
    expect(window.localStorage.getItem('delta-comic.admin.endpoint')).toBe('https://example.com')
    expect(window.sessionStorage.getItem('delta-comic.admin.token')).toBe('token')

    store.clearToken()
    expect(store.adminToken).toBe('')
    expect(store.hasCredentials).toBe(false)
    expect(window.sessionStorage.getItem('delta-comic.admin.token')).toBeNull()
  })

  it('hydrates browser credentials and rejects client creation without an endpoint', () => {
    window.localStorage.setItem('delta-comic.admin.endpoint', 'https://stored.example/api')
    window.sessionStorage.setItem('delta-comic.admin.token', 'stored-token')
    const hydrated = useConnectionStore()
    expect(hydrated.apiBaseUrl).toBe('https://stored.example')
    expect(hydrated.adminToken).toBe('stored-token')

    setActivePinia(createPinia())
    window.localStorage.clear()
    const empty = useConnectionStore()
    expect(() => empty.createClient()).toThrow('请先配置 Server API 地址')
    expect(() => empty.saveCredentials('ftp://example.com', 'token')).toThrow(/http/)
  })

  it('short-circuits missing credentials and connects with capabilities', async () => {
    const store = useConnectionStore()
    await expect(store.connect()).resolves.toBe(false)
    expect(store.error).toContain('请先在设置中')

    store.saveCredentials('https://example.com', 'token')
    const get = vi.spyOn(AdminApiClient.prototype, 'get').mockResolvedValue(capabilities)
    await expect(store.connect()).resolves.toBe(true)

    expect(get).toHaveBeenCalledWith('/api/admin/capabilities')
    expect(store.status).toBe('connected')
    expect(store.isConnected).toBe(true)
    expect(store.capabilities).toEqual(capabilities)
  })

  it('turns API failures into readable connection state', async () => {
    const store = useConnectionStore()
    store.saveCredentials('https://example.com', 'token')
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
    connection.saveCredentials('https://example.com', 'token')
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