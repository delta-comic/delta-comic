import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { shallowRef } from 'vue'

const mocks = vi.hoisted(() => ({
  corePointer: {
    config: { darkMode: { default: 'system', type: 'string' } },
    configName: 'core',
    key: Symbol('core'),
    pluginName: 'core',
  },
  stores: new Map<string, any>(),
  useDbConfig: vi.fn(),
}))

vi.mock('@delta-comic/db', () => ({ useConfig: mocks.useDbConfig }))
vi.mock('./features/core/config', () => ({ coreConfig: mocks.corePointer }))

import { ConfigStore } from './config'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.stores.clear()
  mocks.useDbConfig.mockImplementation((name: string) => {
    const store = mocks.stores.get(name) ?? shallowRef({ darkMode: 'system' })
    Object.assign(store, { ready: Promise.resolve() })
    mocks.stores.set(name, store)
    return store
  })
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  )
})

describe('plugin config store', () => {
  it.each([
    ['light', false],
    ['dark', true],
    ['system', true],
  ] as const)('derives %s dark mode from the registered core config', (darkMode, expected) => {
    const coreStore = shallowRef({ darkMode })
    Object.assign(coreStore, { ready: Promise.resolve() })
    mocks.stores.set('core', coreStore)

    const store = new ConfigStore()

    expect(store.isDark).toBe(expected)
    coreStore.value = { darkMode: darkMode === 'dark' ? 'light' : 'dark' }
    expect(store.isDark).toBe(darkMode !== 'dark')
  })

  it('registers each pointer once and exposes its readiness contract', async () => {
    const store = new ConfigStore()
    const pointer = {
      config: { enabled: { default: true, type: 'boolean' } },
      configName: 'fixture',
      key: Symbol('fixture'),
      pluginName: 'fixture',
    }

    const first = store.$registerConfig(pointer as never)
    const second = store.$registerConfig(pointer as never)

    expect(first).toBe(second)
    expect(store.$isExistConfig(pointer as never)).toBe(true)
    expect(store.$load(pointer as never)).toBe(first)
    await expect(first.ready).resolves.toBeUndefined()
    expect(mocks.useDbConfig).toHaveBeenCalledTimes(2)
  })

  it('throws for missing pointers and supports explicit removal', () => {
    const store = new ConfigStore()
    const pointer = {
      config: {},
      configName: 'missing',
      key: Symbol('missing'),
      pluginName: 'missing',
    }

    expect(() => store.$load(pointer as never)).toThrow('not found config by plugin "missing"')
    store.$registerConfig(pointer as never)
    store.$unregisterConfig(pointer as never)
    expect(store.$isExistConfig(pointer as never)).toBe(false)
  })
})