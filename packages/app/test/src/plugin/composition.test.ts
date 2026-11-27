import { db } from '@delta-comic/platform/db'
import type { PluginManifest } from '@delta-comic/platform/manifest'
import type { Component, Context } from 'cordis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

declare module 'cordis' {
  interface Context {
    testProvider: number
  }
}

const state = vi.hoisted(() => ({
  archives: new Map<
    string,
    {
      pluginName: string
      revision?: string
      meta: unknown
      enable: boolean
      config: Record<string, unknown>
    }
  >(),
  modules: new Map<string, readonly Component.Function[]>(),
  released: vi.fn(),
  builtins: new Array<{ manifest: PluginManifest; functions: readonly Component.Function[] }>(),
}))

vi.mock('../../../src/plugin/seed', () => ({ hostSeed: new Map() }))
vi.mock('@delta-comic/platform/db', () => ({ db: {} }))
vi.mock('../../../src/plugin/adapters/index', () => ({
  AwesomeRegistryClient: class {},
  ConfigStore: class {
    register() {
      return { ready: Promise.resolve() }
    }
    load() {
      return { data: { value: {} } }
    }
  },
  createDefaultPluginFileStore: () => ({ collectRevisions: vi.fn() }),
  pluginI18n: { translateText: (text: string) => text },
}))
vi.mock('../../../src/plugin/adapters/pluginRepository', () => ({
  DatabasePluginArchiveRepository: class {
    async list() {
      return [...state.archives.values()]
    }
    async find(id: string) {
      return state.archives.get(id)
    }
    async upsert(archive: {
      pluginName: string
      meta: PluginManifest
      enable: boolean
      config: Record<string, unknown>
    }) {
      state.archives.set(archive.pluginName, archive)
    }
  },
}))
vi.mock('../../../src/plugin/builtins/index', () => ({
  builtinPlugins: state.builtins,
  coreManifest: { id: 'core', name: 'Core', version: '1.0.0' },
}))
vi.mock('@/plugin/install', async importOriginal => ({
  ...(await importOriginal<typeof import('@/plugin/install')>()),
  StoredPluginModuleReader: class {
    async prepare(archive: { pluginName: string }) {
      const functions = state.modules.get(archive.pluginName)
      if (!functions) throw new Error('module unavailable')
      return {
        entry: {
          package: archive.pluginName,
          exports: [],
          externals: [],
          factory: () => ({ components: functions, modules: {} }),
        },
        load: () => ({ functions, dispose: () => state.released(archive.pluginName) }),
      }
    }
  },
}))

let host: typeof import('../../../src/plugin/composition')
beforeEach(async () => {
  vi.resetModules()
  state.archives.clear()
  state.modules.clear()
  state.released.mockClear()
  state.builtins.length = 0
  host = await import('../../../src/plugin/composition')
})
afterEach(async () => {
  await host.disposePluginHost()
})

const install = (id: string, functions: readonly Component.Function[]) => {
  state.archives.set(id, {
    revision: '1'.repeat(64),
    pluginName: id,
    enable: true,
    config: {},
    meta: {
      id,
      name: id,
      version: '1.0.0',
      formatVersion: 2 as const,
      package: id,
      supportCoreVersion: '*',
      exports: [],
      externals: [],
      pluginPeers: {},
      script: 'index.js',
      resources: [
        {
          path: 'index.js',
          mimeType: 'text/javascript',
          integrity: 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        },
      ],
    },
  })
  state.modules.set(id, functions)
}
const prepare = () =>
  host.preparePluginHost({ database: { db, query: (_name, operation) => operation(db) } })

describe('native package lifecycle', () => {
  it('retains built-in identity when an installation uses its reserved ID', async () => {
    await host.disposePluginHost()
    vi.resetModules()
    const manifest: PluginManifest = {
      id: 'core',
      name: 'Core',
      version: '1.0.0',
      formatVersion: 2 as const,
      package: 'demo',
      supportCoreVersion: '*',
      exports: [],
      externals: [],
      pluginPeers: {},
      script: 'core',
      resources: [],
    }
    state.builtins.push({ manifest, functions: [function core() {}] })
    host = await import('../../../src/plugin/composition')
    install('core', [function installedCore() {}])
    await prepare()
    await host.loadEnabledPlugins()
    expect(host.pluginInstallations.get('core')).toMatchObject({
      manifest,
      origin: 'builtin',
      enabled: true,
    })
    await expect(host.uninstallPlugin('core')).rejects.toThrow('host plugin cannot be uninstalled')
  })

  it('keeps invalid installations manageable by ID when the manifest requires rebuilding', async () => {
    state.archives.set('invalid', {
      pluginName: 'invalid',
      meta: { id: 'invalid' },
      enable: true,
      config: {},
    })
    await prepare()
    await host.loadEnabledPlugins()
    expect(host.pluginSafeMode.value).toBe(false)
    expect(host.pluginInstallations.get('invalid')).toMatchObject({ manifest: null, enabled: true })
    expect(host.pluginStore.displayName('invalid')).toBe('invalid')
    await host.setPluginEnabled('invalid', false)
    expect(state.archives.get('invalid')?.enable).toBe(false)
  })

  it('validates native Config while disabled and reactivates a repaired failed group', async () => {
    const configured = Object.assign(function configured() {}, {
      Config: {
        '~standard': {
          version: 1,
          vendor: 'test',
          validate(value: unknown) {
            return typeof value === 'object' && value !== null && 'token' in value
              ? { value }
              : { issues: [{ message: 'token required' }] }
          },
        },
      },
    } satisfies Partial<Component.Function>)
    install('configured', [configured])
    await prepare()
    await host.loadEnabledPlugins().catch(() => {})
    expect(host.pluginSafeMode.value).toBe(false)
    await host.setPluginEnabled('configured', false)
    await expect(host.setPluginConfig('configured', {})).rejects.toThrow('token required')
    expect(state.archives.get('configured')?.config).toEqual({})
    await host.setPluginConfig('configured', { token: 'valid' })
    await host.setPluginEnabled('configured', true)
    expect(host.pluginStatuses.get('configured')?.state).toBe(2)
    expect(host.pluginFibers.has('configured')).toBe(true)
  })
  it('mounts arrays before settling and restores consumers with their provider', async () => {
    const cleanup = vi.fn()
    const started = vi.fn()
    const consumer = Object.assign(
      function consumer(ctx: Context) {
        started(ctx.testProvider)
        ctx.effect(() => cleanup)
      },
      { inject: ['testProvider'] },
    )
    const provider = Object.assign(
      function provider(ctx: Context) {
        ctx.provide('testProvider', 42)
      },
      { provide: ['testProvider'] },
    )
    install('consumer', [consumer])
    install('provider', [provider])
    await prepare()
    await host.loadEnabledPlugins()
    expect(started).toHaveBeenCalledWith(42)
    expect(host.pluginStatuses.get('consumer')?.state).toBe(2)
    await host.setPluginEnabled('provider', false)
    expect(cleanup).toHaveBeenCalledOnce()
    expect(host.pluginStatuses.get('consumer')?.state).toBe(0)
    await host.setPluginEnabled('provider', true)
    expect(started).toHaveBeenCalledTimes(2)
    expect(host.pluginStatuses.get('consumer')?.state).toBe(2)
  })

  it('isolates startup failures and permits individual recovery', async () => {
    const cleanup = vi.fn()
    install('healthy', [
      function healthy(ctx: Context) {
        ctx.effect(() => cleanup)
      },
    ])
    install('broken', [
      function broken() {
        throw new Error('startup failed')
      },
    ])
    await prepare()
    await host.loadEnabledPlugins()
    expect(host.pluginSafeMode.value).toBe(false)
    expect(host.pluginFibers.size).toBe(1)
    expect(cleanup).not.toHaveBeenCalled()
    expect(state.archives.get('healthy')?.enable).toBe(true)
    expect(state.archives.get('broken')?.enable).toBe(true)
    expect(host.pluginStatuses.get('broken')).toMatchObject({
      state: 3,
      source: 'broken',
      error: 'startup failed',
    })
    await host.setPluginEnabled('healthy', true)
    expect(host.pluginFibers.has('healthy')).toBe(true)
    expect(host.pluginFibers.has('broken')).toBe(false)
  })

  it('replaces hot functions and releases the preceding package resources', async () => {
    const cleanup = vi.fn()
    install('reader', [
      Object.assign(
        function reader(ctx: Context) {
          ctx.share.register({ share: { initiative: [] } })
          ctx.effect(() => cleanup)
        },
        { inject: ['share'] },
      ),
    ])
    await prepare()
    await host.loadEnabledPlugins()
    state.modules.set('reader', [
      Object.assign(
        function updated(ctx: Context) {
          ctx.share.register({ share: { initiative: [] } })
        },
        { inject: ['share'] },
      ),
    ])
    await host.reloadPlugin('reader')
    expect(cleanup).toHaveBeenCalledOnce()
    expect(state.released).toHaveBeenCalledWith('reader')
    expect(host.pluginStore.share.has('reader')).toBe(true)
    expect(host.pluginStatuses.get('reader')?.state).toBe(2)
  })
})