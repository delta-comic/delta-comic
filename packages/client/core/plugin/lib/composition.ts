import {
  createClientDownloader,
  createClientNetwork,
  DiagnosticRecorder,
  type ClientDatabase,
  type ClientNetwork,
  type ClientUiRegistrars,
  type DiagnosticRecord,
} from '@delta-comic/client'
import {
  DevServerPluginModuleReader,
  DevServerSourceResolver,
  DEV_SERVER_LOADER_ID,
  GitHubSourceResolver,
  HttpSourceResolver,
  LocalFileSourceResolver,
  MarketplaceSourceResolver,
  PluginInstallService,
  StoredPluginModuleReader,
  ZipPackageCodec,
  devServerUrl,
  parseClientPluginEntry,
  parseDevServerPort,
  safePluginPath,
  type LoadedPluginModule,
  type PluginCatalog,
  type PluginInstallReporter,
  type PluginModuleReader,
} from '@delta-comic/client-core-plugin-install'
import type { DB } from '@delta-comic/client-data-db'
import { isPluginManifest, type PluginManifest } from '@delta-comic/shared-plugin-manifest'
import {
  Context,
  DisposableList,
  resolveConfig,
  type FiberState,
  type Fiber,
  type Plugin,
} from 'cordis'
import { computed, shallowReactive, shallowRef } from 'vue'

import {
  AwesomeRegistryClient,
  ConfigStore,
  createDefaultPluginFileStore,
  pluginI18n,
} from './adapters'
import { DatabasePluginArchiveRepository } from './adapters/pluginRepository'
import { builtinPlugins, coreManifest } from './builtins'
import { cfg } from './core/config'
import {
  ConfigService,
  ContentService,
  I18nService,
  RemoteService,
  ShareService,
  UiService,
  UserService,
  type PluginAuthGateway,
} from './services'

export const pluginFiberStates = {
  PENDING: 0,
  LOADING: 1,
  ACTIVE: 2,
  FAILED: 3,
  DISPOSED: 4,
  UNLOADING: 5,
} satisfies Record<string, FiberState>

export interface PluginInstallation {
  readonly manifest: PluginManifest | null
  readonly enabled: boolean
  readonly config: Record<string, unknown>
  readonly origin: 'builtin' | 'installed'
}

export interface PluginStatus {
  readonly state: FiberState
  readonly source?: string
  readonly error?: string
}

export const pluginContext = new Context()
export const pluginFibers = shallowReactive(new Map<string, Fiber>())
export const pluginInstallations = shallowReactive(new Map<string, PluginInstallation>())
export const pluginStatuses = shallowReactive(new Map<string, PluginStatus>())
export const pluginSafeMode = shallowRef(false)
export const pluginConfigStore = new ConfigStore()
export const useConfig = () => pluginConfigStore
const owners = new WeakMap<Fiber, string>()
const loadedModules = new Map<string, LoadedPluginModule>()
const children = new Map<string, Fiber[]>()
let generation = 0
let failedGeneration = -1
let cleanup: Promise<void> | undefined
let management = Promise.resolve()
let initialization: Promise<void> | undefined

export interface PluginHostServices {
  readonly auth?: PluginAuthGateway
  readonly diagnosticSink?: (record: DiagnosticRecord) => void | Promise<void>
}

const hostServices: PluginHostServices = {}
export const configurePluginHost = (services: PluginHostServices) => {
  Object.assign(hostServices, services)
}

export const pluginDiagnostics = new DiagnosticRecorder({
  source: 'client',
  onRecord: record => hostServices.diagnosticSink?.(record),
})

const pluginFiles = createDefaultPluginFileStore()
const repository = new DatabasePluginArchiveRepository()
const readers: readonly PluginModuleReader[] = [
  new DevServerPluginModuleReader(),
  new StoredPluginModuleReader(pluginFiles),
]
const internalIds = new Set(builtinPlugins.map(plugin => plugin.manifest.id))
const httpSource = new HttpSourceResolver()
const githubSource = new GitHubSourceResolver({
  coreVersion: coreManifest.version,
  includePrereleases: () => pluginConfigStore.load(cfg).data.value.receivePerReleaseUpdate,
})
const awesomeRegistry = new AwesomeRegistryClient()
export const pluginCatalog: PluginCatalog = awesomeRegistry

export const pluginInstaller = new PluginInstallService({
  codecs: [new ZipPackageCodec()],
  files: pluginFiles,
  repository,
  reservedIds: internalIds,
  resolvers: [
    new LocalFileSourceResolver(),
    new DevServerSourceResolver(),
    new MarketplaceSourceResolver(awesomeRegistry, [githubSource, httpSource]),
    githubSource,
    httpSource,
  ],
})

const findOwner = (fiber: Fiber): string | undefined => {
  let current = fiber
  for (;;) {
    const id = owners.get(current)
    if (id) return id
    const parent = current.parent.fiber
    if (parent === current) return
    current = parent
  }
}

const owner = (ctx: Context) => {
  const id = findOwner(ctx.fiber)
  if (!id) throw new Error('plugin registration requires an installed package fiber')
  return id
}

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error))

const unload = async (id: string) => {
  const fiber = pluginFibers.get(id)
  pluginFibers.delete(id)
  children.delete(id)
  try {
    await fiber?.dispose()
  } finally {
    const module = loadedModules.get(id)
    loadedModules.delete(id)
    await module?.dispose?.()
  }
}

const enterSafeMode = (id: string, source: string, error: unknown) => {
  if (failedGeneration === generation) return cleanup ?? Promise.resolve()
  failedGeneration = generation
  pluginSafeMode.value = true
  pluginStatuses.set(id, { state: pluginFiberStates.FAILED, source, error: describe(error) })
  pluginDiagnostics.record('error', 'plugin lifecycle failed', {
    pluginId: id,
    source,
    error: describe(error),
  })
  cleanup = (async () => {
    const ids = [...pluginFibers.keys()].filter(id => !internalIds.has(id))
    const results = await Promise.allSettled(ids.map(unload))
    for (const [index, result] of results.entries()) {
      if (result.status === 'rejected') {
        pluginDiagnostics.record('error', 'plugin cleanup failed', {
          pluginId: ids[index],
          error: describe(result.reason),
        })
      }
    }
  })()
  return cleanup
}

pluginContext.on(
  'internal/status',
  fiber => {
    const id = findOwner(fiber)
    if (!id) return
    if (fiber.state === pluginFiberStates.FAILED && !internalIds.has(id)) {
      void fiber.await().catch(error => enterSafeMode(id, fiber.name, error))
      return
    }
    if (pluginStatuses.get(id)?.state === pluginFiberStates.FAILED && pluginSafeMode.value) return
    const fibers = children.get(id) ?? []
    const state = fibers.some(child => child.state === pluginFiberStates.PENDING)
      ? pluginFiberStates.PENDING
      : fibers.some(child => child.state === pluginFiberStates.LOADING)
        ? pluginFiberStates.LOADING
        : (pluginFibers.get(id)?.state ?? fiber.state)
    pluginStatuses.set(id, { state })
  },
  { global: true },
)

pluginContext.logger.exporter({
  export: message => {
    const fiber = message.fiber?.deref()
    pluginDiagnostics.record(message.type, message.args.map(describe).join(' '), {
      pluginId: fiber ? findOwner(fiber) : undefined,
      fiberId: fiber?.uid === null ? undefined : String(fiber?.uid),
      source: fiber?.name,
    })
  },
})

const refreshInstallations = async () => {
  const archives = await repository.list()
  pluginInstallations.clear()
  for (const builtin of builtinPlugins) {
    pluginInstallations.set(builtin.manifest.id, {
      manifest: builtin.manifest,
      enabled: true,
      config: {},
      origin: 'builtin',
    })
  }
  for (const archive of archives) {
    if (internalIds.has(archive.pluginName)) continue
    pluginInstallations.set(archive.pluginName, {
      manifest: isPluginManifest(archive.meta) ? archive.meta : null,
      enabled: archive.enable,
      config: archive.config ?? {},
      origin: 'installed',
    })
  }
}

const mount = async (id: string, override?: readonly Plugin.Function[]) => {
  const installation = pluginInstallations.get(id)
  if (!installation) throw new Error(`installed plugin not found: ${id}`)
  if (!installation.manifest) throw new TypeError(`invalid plugin manifest: ${id}`)
  let module: LoadedPluginModule
  const builtin = builtinPlugins.find(plugin => plugin.manifest.id === id)
  if (builtin) module = { functions: builtin.functions }
  else {
    const archive = await repository.find(id)
    if (!archive) throw new Error(`installed plugin not found: ${id}`)
    const reader = readers.find(reader => reader.matches?.(archive)) ?? readers.at(-1)
    if (!reader) throw new Error('no client module reader')
    module = await reader.read(archive, new AbortController().signal)
  }
  if (override) module = { ...module, functions: override }
  if (failedGeneration === generation) {
    await module.dispose?.()
    throw new Error('plugin loading stopped after lifecycle failure')
  }
  loadedModules.set(id, module)
  pluginStatuses.set(id, { state: pluginFiberStates.LOADING })
  const group: Fiber[] = []
  children.set(id, group)
  const fiber = pluginContext.plugin({
    name: id,
    apply(ctx) {
      owners.set(ctx.fiber, id)
      module.activate?.(ctx)
      for (const fn of module.functions) group.push(ctx.plugin(fn, installation.config))
    },
  })
  pluginFibers.set(id, fiber)
}

const stabilize = async () => {
  for (;;) {
    const fibers = [...pluginFibers.values(), ...children.values()].flat()
    await Promise.all(fibers.map(fiber => fiber.await()))
    if (!fibers.some(fiber => fiber.inertia)) return
  }
}

const managed = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = management.then(async () => {
    await cleanup
    generation++
    return await operation()
  })
  management = result.then(
    () => {},
    () => {},
  )
  return result
}

export interface PreparePluginHostOptions {
  readonly database: ClientDatabase<DB>
  readonly uiRegistrars?: ClientUiRegistrars
  readonly network?: ClientNetwork
}

export const preparePluginHost = async (options: PreparePluginHostOptions) => {
  initialization ??= (async () => {
    await pluginConfigStore.register(cfg).ready
    await pluginContext.plugin(ctx => {
      new ConfigService(ctx, {
        get: id => pluginInstallations.get(id)?.config ?? {},
        set: setPluginConfig,
      })
      new ContentService(ctx, owner)
      new UserService(ctx, owner, () => hostServices.auth)
      new RemoteService(ctx, owner)
      new ShareService(ctx, owner)
      new I18nService(ctx, owner)
      new UiService(ctx, owner, options.uiRegistrars ?? {})
      ctx.provide('database', options.database)
      ctx.provide('network', options.network ?? createClientNetwork(pluginDiagnostics, 'app'))
      const downloader = createClientDownloader(pluginDiagnostics, 'app', { key: 'app:plugins' })
      ctx.provide('downloader', downloader)
      ctx.provide('diagnostics', pluginDiagnostics)
      ctx.effect(() => () => downloader.dispose())
    })
    for (const builtin of builtinPlugins) {
      pluginInstallations.set(builtin.manifest.id, {
        manifest: builtin.manifest,
        enabled: true,
        config: {},
        origin: 'builtin',
      })
    }
    for (const id of internalIds) await mount(id)
    await stabilize()
  })()
  await initialization
}

export const loadEnabledPlugins = () =>
  managed(async () => {
    try {
      await refreshInstallations()
    } catch (error) {
      await enterSafeMode('installation', 'installation records', error)
      throw error
    }
    for (const [id, installation] of pluginInstallations) {
      if (installation.origin === 'builtin' || !installation.enabled || pluginFibers.has(id))
        continue
      try {
        await mount(id)
      } catch (error) {
        await enterSafeMode(id, id, error)
        throw error
      }
      if (failedGeneration === generation) break
    }
    try {
      await stabilize()
    } catch (error) {
      const failed = [...children].find(([, group]) =>
        group.some(fiber => fiber.state === pluginFiberStates.FAILED),
      )
      await enterSafeMode(
        failed?.[0] ?? 'loading',
        failed?.[1].find(fiber => fiber.state === pluginFiberStates.FAILED)?.name ?? 'loading',
        error,
      )
      throw error
    }
  })

const reload = async (id: string, override?: readonly Plugin.Function[]) => {
  await unload(id)
  await refreshInstallations()
  try {
    if (pluginInstallations.get(id)?.enabled) await mount(id, override)
    await stabilize()
  } catch (error) {
    await enterSafeMode(id, id, error)
    throw error
  }
}

export interface PluginInstallOptions {
  readonly report?: PluginInstallReporter
  readonly signal?: AbortSignal
}

export const installPlugin = (input: File | string, options: PluginInstallOptions = {}) =>
  managed(async () =>
    pluginInstaller.install(input, options.signal, options.report, {
      afterStage: archive => reload(archive.pluginName),
    }),
  )

export const updatePluginByName = (id: string, options: PluginInstallOptions = {}) =>
  managed(async () => {
    const archive = await repository.find(id)
    if (!archive?.installInput) throw new Error(`plugin has no update source: ${id}`)
    return await pluginInstaller.install(archive.installInput, options.signal, options.report, {
      afterStage: staged => reload(staged.pluginName),
    })
  })

export const setPluginEnabled = (id: string, enabled: boolean) =>
  managed(async () => {
    if (internalIds.has(id)) throw new Error(`host plugin cannot be disabled: ${id}`)
    const archive = await repository.find(id)
    if (!archive) throw new Error(`installed plugin not found: ${id}`)
    await repository.upsert({ ...archive, enable: enabled })
    await reload(id)
  })

export const setPluginConfig = (id: string, config: Record<string, unknown>) =>
  managed(async () => {
    const archive = await repository.find(id)
    if (!archive) throw new Error(`installed plugin not found: ${id}`)
    const module =
      loadedModules.get(id) ??
      (await (
        readers.find(reader => reader.matches?.(archive)) ?? readers[readers.length - 1]
      ).read(archive, new AbortController().signal))
    try {
      for (const fn of module.functions) {
        resolveConfig(
          {
            callback: (ctx: Context, value: Record<string, unknown>) => fn(ctx, value),
            Config: fn.Config,
            fibers: new DisposableList(),
          },
          config,
        )
      }
    } finally {
      if (!loadedModules.has(id)) await module.dispose?.()
    }
    await repository.upsert({ ...archive, config })
    await reload(id)
  })

export const uninstallPlugin = (id: string) =>
  managed(async () => {
    if (internalIds.has(id)) throw new Error(`host plugin cannot be uninstalled: ${id}`)
    await unload(id)
    await pluginInstaller.uninstall(id)
    await refreshInstallations()
  })

export const reloadPlugin = (id: string, functions?: readonly Plugin.Function[]) =>
  managed(() => reload(id, functions))

export const disposePluginHost = async () => {
  await management
  await Promise.allSettled([...pluginFibers.keys()].map(unload))
  await pluginContext.fiber.dispose()
}

const ready = computed(
  () =>
    new Set(
      [...pluginStatuses]
        .filter(([, value]) => value.state === pluginFiberStates.ACTIVE)
        .map(([id]) => id),
    ),
)

export const pluginStore = {
  installations: pluginInstallations,
  fibers: pluginFibers,
  statuses: pluginStatuses,
  safeMode: pluginSafeMode,
  get ready() {
    return ready.value
  },
  get content() {
    const service = pluginContext.get('content')
    if (!service) throw new Error('content service is unavailable')
    return service.entries
  },
  get user() {
    const service = pluginContext.get('user')
    if (!service) throw new Error('user service is unavailable')
    return service.entries
  },
  get remote() {
    const service = pluginContext.get('remote')
    if (!service) throw new Error('remote service is unavailable')
    return service.entries
  },
  get share() {
    const service = pluginContext.get('share')
    if (!service) throw new Error('share service is unavailable')
    return service.entries
  },
  isLoaded: (id: string) => ready.value.has(id),
  displayName: (id: string) =>
    pluginI18n.translateText(pluginInstallations.get(id)?.manifest?.name ?? id),
}

export const usePluginStore = () => pluginStore

if (typeof window !== 'undefined') {
  window.addEventListener('delta-comic:plugin-update', event => {
    if (!(event instanceof CustomEvent)) return
    const detail: unknown = event.detail
    if (
      typeof detail !== 'object' ||
      detail === null ||
      !('id' in detail) ||
      typeof detail.id !== 'string' ||
      !('functions' in detail)
    )
      return
    const id = detail.id
    if (!pluginFibers.has(id)) return
    try {
      const functions = parseClientPluginEntry(detail.functions, id)
      void reloadPlugin(id, functions).catch(error =>
        pluginDiagnostics.record('error', 'plugin hot update failed', {
          pluginId: id,
          error: describe(error),
        }),
      )
    } catch (error) {
      void enterSafeMode(id, 'hot update', error)
    }
  })
}

export const resolvePluginIconUrl = async (
  plugin: string | undefined,
  icon: string | undefined,
) => {
  if (!icon) return
  if (/^https?:\/\//i.test(icon)) return icon
  if (!plugin) throw new Error('plugin id is required for a local icon')
  const archive = await repository.find(plugin)
  if (archive?.loaderName === DEV_SERVER_LOADER_ID) {
    const port = parseDevServerPort(archive.installInput)
    if (port === undefined)
      throw new Error(`invalid development install source: ${archive.installInput}`)
    return devServerUrl(port, safePluginPath(icon, 'icon path'))
  }
  return await pluginFiles.createAssetUrl(plugin, icon)
}

export {
  getTauriPluginRoot,
  pluginI18n,
  type PluginI18nAdapter,
  type PluginLocaleMessages,
} from './adapters'