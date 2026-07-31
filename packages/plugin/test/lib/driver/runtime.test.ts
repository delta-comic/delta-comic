import type { PluginArchiveDB } from '@delta-comic/db'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => {
  const state = {
    archives: [] as PluginArchiveDB.Archive[],
    bootFailures: new Map<string, Error>(),
    cleanupFailure: undefined as Error | undefined,
    factories: new Map<string, () => any>(),
    planError: undefined as string | undefined,
    planLevels: undefined as PluginArchiveDB.Archive[][] | undefined,
    takeFirst: undefined as PluginArchiveDB.Archive | undefined,
  }
  return {
    bootResolvedConfig: vi.fn(async (config: { name: string }, progress: any) => {
      const failure = state.bootFailures.get(config.name)
      if (failure) throw failure
      progress.value[config.name] ??= { progress: { status: 'wait', stepsIndex: 0 }, steps: [] }
      progress.value[config.name].progress.status = 'done'
    }),
    cleanupPlugin: vi.fn(() => {
      if (state.cleanupFailure) throw state.cleanupFailure
    }),
    configRegister: vi.fn(() => ({ ready: Promise.resolve() })),
    deleteExecute: vi.fn(async () => undefined),
    globalRemove: vi.fn(),
    loadPluginConfig: vi.fn(async (archive: PluginArchiveDB.Archive) =>
      state.factories.get(archive.pluginName),
    ),
    refreshNames: vi.fn(async () => undefined),
    removePluginFiles: vi.fn(async () => undefined),
    state,
    synchronizeBuiltInPlugins: vi.fn(async () => undefined),
    touch: vi.fn(),
    updateExecute: vi.fn(async () => undefined),
    withRegistrationOwner: vi.fn(async (_name: string, action: () => Promise<unknown>) => action()),
  }
})

vi.mock('@delta-comic/db', () => ({
  db: {
    deleteFrom: vi.fn(() => ({ where: vi.fn(() => ({ execute: mocks.deleteExecute })) })),
    selectFrom: vi.fn(() => {
      const query: any = {
        execute: vi.fn(async () => mocks.state.archives),
        executeTakeFirst: vi.fn(async () => mocks.state.takeFirst),
        select: vi.fn(() => query),
        selectAll: vi.fn(() => query),
        where: vi.fn(() => query),
      }
      return query
    }),
    updateTable: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ execute: mocks.updateExecute })) })),
    })),
  },
}))

vi.mock('@/config', () => ({ useConfig: () => ({ $registerConfig: mocks.configRegister }) }))

vi.mock('@/global', () => ({
  Global: {
    removeOwnedRegistrations: mocks.globalRemove,
    withRegistrationOwner: mocks.withRegistrationOwner,
  },
}))

vi.mock('@/i18n', () => ({
  pluginI18n: {
    translate: (key: string, values?: Record<string, string>) =>
      values?.plugins ? `${key}:${values.plugins}` : key,
  },
  pluginMessageKey: (key: string) => key,
}))

vi.mock('../../../lib/driver/builtIn', () => ({
  isBuiltInPlugin: (archive: PluginArchiveDB.Archive) => archive.loaderName === 'built-in',
  synchronizeBuiltInPlugins: mocks.synchronizeBuiltInPlugins,
}))

vi.mock('../../../lib/driver/cleanup', () => ({ cleanupPlugin: mocks.cleanupPlugin }))
vi.mock('../../../lib/driver/init/storage', () => ({
  isTauriRuntime: () => false,
  removePluginFiles: mocks.removePluginFiles,
}))
vi.mock('../../../lib/driver/loader', () => ({
  bootResolvedConfig: mocks.bootResolvedConfig,
  loadPluginConfig: mocks.loadPluginConfig,
}))
vi.mock('../../../lib/driver/loadPlan', () => ({
  formatPluginLoadPlanError: () => mocks.state.planError,
  planPluginLoadOrder: (plugins: PluginArchiveDB.Archive[]) => ({
    levels: mocks.state.planLevels ?? [plugins],
  }),
}))
vi.mock('../../../lib/driver/runtimePlan', () => ({
  failedDependencies: (archive: PluginArchiveDB.Archive, failed: Set<string>) =>
    archive.meta.require.map(requirement => requirement.id).filter(id => failed.has(id)),
  filterPluginsBySelection: (plugins: PluginArchiveDB.Archive[], selected?: Set<string>) =>
    selected ? plugins.filter(plugin => selected.has(plugin.pluginName)) : plugins,
  pluginKind: (archive: PluginArchiveDB.Archive) => archive.meta.kind ?? 'normal',
  selectPluginsForPhase: (plugins: PluginArchiveDB.Archive[], kind: 'normal' | 'preboot') =>
    plugins.filter(plugin => (plugin.meta.kind ?? 'normal') === kind),
}))
vi.mock('../../../lib/driver/store', () => ({
  pluginStore: { $refreshI18nNames: mocks.refreshNames, $touch: mocks.touch },
}))
vi.mock('../../../lib/features/core/runtime', () => ({ registerCoreRuntimeExtensions: vi.fn() }))

const archive = (
  pluginName: string,
  options: {
    builtIn?: boolean
    enable?: boolean
    kind?: 'normal' | 'preboot'
    require?: string[]
  } = {},
) =>
  ({
    displayName: pluginName,
    enable: options.enable ?? true,
    installInput: '',
    installerName: '',
    loaderName: options.builtIn ? 'built-in' : 'test-loader',
    meta: {
      author: 'test',
      description: 'runtime fixture',
      kind: options.kind,
      name: { display: pluginName, id: pluginName },
      require: (options.require ?? []).map(id => ({ id })),
      version: { plugin: '1.0.0', supportCore: '*' },
    },
    pluginName,
  }) as PluginArchiveDB.Archive

const createStorage = () => {
  const values = new Map<string, string>()
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    values,
  }
}

const loadRuntime = async () => {
  vi.resetModules()
  return (await import('../../../lib/driver/runtime')).pluginRuntime
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.state.archives = []
  mocks.state.bootFailures.clear()
  mocks.state.cleanupFailure = undefined
  mocks.state.factories.clear()
  mocks.state.planError = undefined
  mocks.state.planLevels = undefined
  mocks.state.takeFirst = undefined
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('plugin runtime normal phase', () => {
  it('loads only selected normal plugins and reports their completed progress', async () => {
    mocks.state.archives = [
      archive('alpha'),
      archive('beta'),
      archive('early', { kind: 'preboot' }),
    ]
    mocks.state.factories.set('alpha', () => ({ name: 'alpha' }))
    mocks.state.factories.set('beta', () => ({ name: 'beta' }))
    const runtime = await loadRuntime()

    const { operation, progress } = runtime.loadNormal({ pluginNames: ['beta'] })
    await operation

    expect(runtime.activeNormalPluginNames).toEqual(['beta'])
    expect(progress.value.beta.progress.status).toBe('done')
    expect(mocks.loadPluginConfig).toHaveBeenCalledOnce()
    expect(mocks.withRegistrationOwner).toHaveBeenCalledWith('beta', expect.any(Function))
  })

  it('blocks dependent plugins after a dependency fails without invoking their factories', async () => {
    mocks.state.archives = [archive('broken'), archive('dependent', { require: ['broken'] })]
    mocks.state.factories.set('broken', () => {
      throw new Error('factory failed')
    })
    mocks.state.factories.set('dependent', () => ({ name: 'dependent' }))
    const runtime = await loadRuntime()

    const { operation, progress } = runtime.loadNormal()
    await operation

    expect(runtime.activeNormalPluginNames).toEqual([])
    expect(progress.value.broken.progress).toMatchObject({
      errorReason: 'factory failed',
      status: 'error',
    })
    expect(progress.value.dependent.progress).toMatchObject({
      errorReason: expect.stringContaining('broken'),
      status: 'error',
    })
    expect(mocks.loadPluginConfig).toHaveBeenCalledOnce()
    expect(mocks.globalRemove).toHaveBeenCalledWith('broken')
  })

  it('rejects invalid plans and releases the in-flight operation guard', async () => {
    mocks.state.archives = [archive('alpha')]
    mocks.state.planError = 'dependency cycle: alpha'
    const runtime = await loadRuntime()

    const first = runtime.loadNormal()
    expect(() => runtime.loadNormal()).toThrow('already loading')
    await expect(first.operation).rejects.toThrow('dependency cycle: alpha')

    mocks.state.planError = undefined
    mocks.state.factories.set('alpha', () => ({ name: 'alpha' }))
    await expect(runtime.loadNormal().operation).resolves.toBeUndefined()
  })

  it('reloads after cleanup and still surfaces unload failures', async () => {
    const onUnload = vi.fn(async () => {
      throw new Error('unload failed')
    })
    mocks.state.archives = [archive('alpha')]
    mocks.state.factories.set('alpha', () => ({ name: 'alpha', onUnload }))
    const runtime = await loadRuntime()
    await runtime.loadNormal().operation

    const reload = runtime.reloadNormal()
    await expect(reload.operation).rejects.toThrow('some plugins failed to unload cleanly')

    expect(onUnload).toHaveBeenCalledOnce()
    expect(mocks.cleanupPlugin).toHaveBeenCalled()
    expect(runtime.activeNormalPluginNames).toEqual(['alpha'])
    expect(() => runtime.loadNormal()).toThrow('already active')
  })

  it('rolls back a resolved config when booting fails', async () => {
    mocks.state.archives = [archive('alpha')]
    mocks.state.factories.set('alpha', () => ({ name: 'alpha' }))
    mocks.state.bootFailures.set('alpha', new Error('booter failed'))
    const runtime = await loadRuntime()

    const { operation, progress } = runtime.loadNormal()
    await operation

    expect(mocks.cleanupPlugin).toHaveBeenCalledWith(expect.objectContaining({ name: 'alpha' }))
    expect(progress.value.alpha.progress).toMatchObject({
      errorReason: 'booter failed',
      status: 'error',
    })
  })
})

describe('plugin runtime preboot phase', () => {
  it('prepares configs before activating them and runs registered cleanup on uninstall', async () => {
    const prebootCleanup = vi.fn()
    const onPreboot = vi.fn(async () => prebootCleanup)
    const onUnload = vi.fn()
    const onUninstall = vi.fn()
    const configPointer = { key: Symbol('config') }
    const early = archive('early', { kind: 'preboot' })
    mocks.state.archives = [early]
    mocks.state.takeFirst = early
    mocks.state.factories.set('early', () => ({
      config: [configPointer],
      name: 'early',
      onPreboot,
      onUnload,
      onUninstall,
    }))
    const runtime = await loadRuntime()

    await expect(runtime.preparePreboot({} as never)).resolves.toEqual({ reloadRequired: false })
    expect(() => runtime.loadNormal()).toThrow('not finished activating')
    await expect(runtime.activatePreboot()).resolves.toEqual({ reloadRequired: false })
    await runtime.uninstall('early')

    expect(mocks.configRegister).toHaveBeenCalledWith(configPointer)
    expect(onPreboot).toHaveBeenCalledWith({ app: {}, platform: 'web', safe: true })
    expect(onUnload).toHaveBeenCalledOnce()
    expect(onUninstall).toHaveBeenCalledOnce()
    expect(prebootCleanup).toHaveBeenCalledOnce()
    expect(mocks.removePluginFiles).toHaveBeenCalledWith('early')
    expect(mocks.deleteExecute).toHaveBeenCalledOnce()
  })

  it('activates immediately when no preboot plugins are enabled', async () => {
    mocks.state.archives = [archive('disabled', { enable: false, kind: 'preboot' })]
    const runtime = await loadRuntime()

    await expect(runtime.preparePreboot({} as never)).resolves.toEqual({ reloadRequired: false })
    await expect(runtime.activatePreboot()).resolves.toEqual({ reloadRequired: false })
  })

  it('disables failed preboot plugins and persists a readable recovery record', async () => {
    const storage = createStorage()
    vi.stubGlobal('localStorage', storage)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-14T00:00:00Z'))
    const early = archive('early', { kind: 'preboot' })
    mocks.state.archives = [early]
    mocks.state.factories.set('early', () => {
      throw new Error('unsafe preboot')
    })
    const runtime = await loadRuntime()

    await expect(runtime.preparePreboot({} as never)).resolves.toEqual({ reloadRequired: true })
    expect(mocks.updateExecute).toHaveBeenCalledOnce()
    expect(runtime.readRecovery()).toEqual({
      failedAt: Date.parse('2026-07-14T00:00:00Z'),
      plugins: ['early'],
      reason: 'unsafe preboot',
    })

    runtime.clearRecovery()
    expect(runtime.readRecovery()).toBeNull()
    vi.useRealTimers()
  })

  it('returns reloadRequired false when disabling failed preboot plugins also fails', async () => {
    mocks.state.archives = [archive('early', { kind: 'preboot' })]
    mocks.state.factories.set('early', () => {
      throw new Error('preboot failure')
    })
    mocks.updateExecute.mockRejectedValueOnce(new Error('database unavailable'))
    const runtime = await loadRuntime()

    const result = await runtime.preparePreboot({} as never)

    expect(result).toEqual({ reloadRequired: false })
  })
})

describe('plugin runtime uninstall', () => {
  it('does nothing for an unknown archive and rejects built-in removal', async () => {
    const runtime = await loadRuntime()
    await expect(runtime.uninstall('missing')).resolves.toBeUndefined()
    expect(mocks.removePluginFiles).not.toHaveBeenCalled()

    mocks.state.takeFirst = archive('core', { builtIn: true })
    await expect(runtime.uninstall('core')).rejects.toThrow('cannot be uninstalled')
  })

  it('runs an inactive plugin uninstall hook before deleting its archive', async () => {
    const onUninstall = vi.fn()
    const inactive = archive('inactive')
    mocks.state.takeFirst = inactive
    mocks.state.factories.set('inactive', () => ({ name: 'inactive', onUninstall }))
    const runtime = await loadRuntime()

    await runtime.uninstall('inactive')

    expect(onUninstall).toHaveBeenCalledOnce()
    expect(mocks.cleanupPlugin).toHaveBeenCalledWith(expect.objectContaining({ name: 'inactive' }))
    expect(mocks.refreshNames).toHaveBeenCalled()
    expect(mocks.touch).toHaveBeenCalledOnce()
  })

  it('removes an archive but reports cleanup errors as an aggregate', async () => {
    const inactive = archive('inactive')
    mocks.state.takeFirst = inactive
    mocks.state.factories.set('inactive', () => ({
      name: 'inactive',
      onUninstall: () => {
        throw new Error('hook failed')
      },
    }))
    mocks.state.cleanupFailure = new Error('cleanup failed')
    const runtime = await loadRuntime()

    await expect(runtime.uninstall('inactive')).rejects.toThrow('removed with cleanup errors')
    expect(mocks.removePluginFiles).toHaveBeenCalledWith('inactive')
    expect(mocks.deleteExecute).toHaveBeenCalledOnce()
  })
})