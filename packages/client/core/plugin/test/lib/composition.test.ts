import { db } from '@delta-comic/db'
import type { PluginManifest } from '@delta-comic/plugin-manifest'
import type { Context, Plugin } from 'cordis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

declare module 'cordis' {
  interface Context {
    testProvider: number
  }
}

const state = vi.hoisted(() => ({
  archives: new Map<
    string,
    { pluginName: string; meta: unknown; enable: boolean; config: Record<string, unknown> }
  >(),
  modules: new Map<string, readonly Plugin.Function[]>(),
  released: vi.fn(),
  builtins: new Array<{ manifest: PluginManifest; functions: readonly Plugin.Function[] }>(),
}))

vi.mock('@delta-comic/db', () => ({ db: {} }))
vi.mock('../../lib/adapters', () => ({
  AwesomeRegistryClient: class {},
  ConfigStore: class {
    register() {
      return { ready: Promise.resolve() }
    }
    load() {
      return { data: { value: {} } }
    }
  },
  createDefaultPluginFileStore: () => ({}),
  pluginI18n: { translateText: (text: string) => text },
}))
vi.mock('../../lib/adapters/pluginRepository', () => ({
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
vi.mock('../../lib/builtins', () => ({
  builtinPlugins: state.builtins,
  coreManifest: { id: 'core', name: 'Core', version: '1.0.0' },
}))
vi.mock('@delta-comic/plugin-install', async importOriginal => ({
  ...(await importOriginal<typeof import('@delta-comic/plugin-install')>()),
  StoredPluginModuleReader: class {
    async read(archive: { pluginName: string }) {
      const functions = state.modules.get(archive.pluginName)
      if (!functions) throw new Error('module unavailable')
      return { functions, dispose: () => state.released(archive.pluginName) }
    }
  },
}))

let host: typeof import('../../lib/composition')
beforeEach(async () => {
  vi.resetModules()
  state.archives.clear()
  state.modules.clear()
  state.released.mockClear()
  state.builtins.length = 0
  host = await import('../../lib/composition')
})
afterEach(async () => {
  await host.disposePluginHost()
})

const install = (id: string, functions: readonly Plugin.Function[]) => {
  state.archives.set(id, {
    pluginName: id,
    enable: true,
    config: {},
    meta: {
      protocolVersion: 2,
      id,
      name: id,
      version: '1.0.0',
      client: { entry: 'index.js' },
      resources: [],
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
      protocolVersion: 2,
      id: 'core',
      name: 'Core',
      version: '1.0.0',
      client: { entry: 'core' },
      resources: [],
    }
    state.builtins.push({ manifest, functions: [function core() {}] })
    host = await import('../../lib/composition')
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

  it('keeps invalid installations manageable by ID during safe mode', async () => {
    state.archives.set('invalid', {
      pluginName: 'invalid',
      meta: { id: 'invalid' },
      enable: true,
      config: {},
    })
    await prepare()
    await expect(host.loadEnabledPlugins()).rejects.toThrow('invalid plugin manifest: invalid')
    expect(host.pluginSafeMode.value).toBe(true)
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
    } satisfies Partial<Plugin.Function>)
    install('configured', [configured])
    await prepare()
    await host.loadEnabledPlugins().catch(() => {})
    expect(host.pluginSafeMode.value).toBe(true)
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

  it('unloads all managed fibers on failure and permits individual recovery', async () => {
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
    await expect(host.loadEnabledPlugins()).rejects.toThrow('startup failed')
    expect(host.pluginSafeMode.value).toBe(true)
    expect(host.pluginFibers.size).toBe(0)
    expect(cleanup).toHaveBeenCalledOnce()
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
    await host.reloadPlugin('reader', [
      Object.assign(
        function updated(ctx: Context) {
          ctx.share.register({ share: { initiative: [] } })
        },
        { inject: ['share'] },
      ),
    ])
    expect(cleanup).toHaveBeenCalledOnce()
    expect(state.released).toHaveBeenCalledWith('reader')
    expect(host.pluginStore.share.has('reader')).toBe(true)
    expect(host.pluginStatuses.get('reader')?.state).toBe(2)
  })
})