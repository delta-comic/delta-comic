import type { FlowInstallation } from '@delta-comic/server'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { AdminApiClient } from '@/shared/api/AdminApiClient'
import { useConnectionStore } from '@/stores/connection'
import { usePluginsStore } from '@/stores/plugins'

const installation: FlowInstallation = {
  manifest: {
    protocolVersion: 2,
    id: 'demo',
    name: 'Demo',
    version: '1.0.0',
    server: { entry: 'flows.json' },
    resources: [],
  },
  document: {
    version: 1,
    flows: [{ id: 'main', steps: [{ id: 'done', op: 'return', value: 1 }] }],
  },
  config: {},
  enabled: true,
}
beforeEach(() => {
  vi.restoreAllMocks()
  const storage = (): Storage => {
    const values = new Map<string, string>()
    return {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value)
      },
      removeItem: key => {
        values.delete(key)
      },
      clear: () => values.clear(),
      key: index => [...values.keys()][index] ?? null,
      get length() {
        return values.size
      },
    }
  }
  Object.defineProperties(window, {
    localStorage: { configurable: true, value: storage() },
    sessionStorage: { configurable: true, value: storage() },
  })
  setActivePinia(createPinia())
  const connection = useConnectionStore()
  connection.saveCredentials('https://example.com', 'admin')
  connection.saveUserToken('user')
})

describe('JSON plugin management store', () => {
  it('installs flow JSON with user credentials and refreshes execution records', async () => {
    const get = vi
      .spyOn(AdminApiClient.prototype, 'get')
      .mockImplementation(async path => (path.endsWith('/runs') ? [] : [installation]))
    const put = vi.spyOn(AdminApiClient.prototype, 'put').mockResolvedValue(installation)
    const post = vi
      .spyOn(AdminApiClient.prototype, 'post')
      .mockResolvedValue({ id: 'run', status: 'succeeded', result: 1 })
    const store = usePluginsStore()
    const input = {
      manifest: installation.manifest,
      source: JSON.stringify(installation.document),
      config: {},
      enabled: true,
    }
    await store.save('demo', input)
    expect(put).toHaveBeenCalledWith('/api/plugins/demo', input)
    expect(store.selected).toEqual(installation)
    expect(await store.run('demo', 'main', { value: 2 })).toMatchObject({ result: 1 })
    expect(post).toHaveBeenCalledWith('/api/plugins/demo/flows/main/run', { input: { value: 2 } })
    expect(get).toHaveBeenCalledWith('/api/plugins/demo/runs')
  })

  it('clears a vanished selection and exposes API failures', async () => {
    const get = vi.spyOn(AdminApiClient.prototype, 'get').mockResolvedValue([])
    const store = usePluginsStore()
    store.selectedId = 'gone'
    await store.load()
    expect(store.selectedId).toBe('')
    expect(store.runs).toEqual([])
    get.mockRejectedValueOnce(new Error('offline'))
    await store.load()
    expect(store.error).toBe('offline')
    expect(store.pending).toBe(false)
  })
})