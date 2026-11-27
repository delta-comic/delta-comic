import {
  createClientNetwork,
  DiagnosticRecorder,
  Downloader,
  type ClientDatabase,
  type ClientNetwork,
  type ClientUiRegistrars,
  type DiagnosticRecord,
} from '@delta-comic/client'
import type { DB, PluginArchiveDB } from '@delta-comic/platform/db'
import {
  dependencyOrder,
  isPluginManifest,
  type PluginManifest,
} from '@delta-comic/platform/manifest'
import { ModuleRegistry } from '@delta-comic/runtime'
import {
  Context,
  type Component,
  DisposableList,
  resolveConfig,
  type FiberState,
  type Fiber,
} from 'cordis'
import { computed, shallowReactive, shallowRef } from 'vue'

import {
  DevServerSourceResolver,
  DEV_SERVER_LOADER_ID,
  DEV_EVENTS_PATH,
  isDevRevision,
  GitHubSourceResolver,
  HttpSourceResolver,
  LocalFileSourceResolver,
  MarketplaceSourceResolver,
  PluginInstallService,
  StoredPluginModuleReader,
  ZipPackageCodec,
  devServerUrl,
  parseDevServerPort,
  type LoadedPluginModule,
  type PluginCatalog,
  type PluginInstallReporter,
} from '@/plugin/install'

import {
  AwesomeRegistryClient,
  ConfigStore,
  createDefaultPluginFileStore,
  pluginI18n,
} from './adapters'
import { DatabasePluginArchiveRepository } from './adapters/pluginRepository'
import { builtinPlugins, coreManifest } from './builtins'
import { cfg } from './core/config'
import { revisionKey } from './install/revision'
import { hostSeed } from './seed'
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
  readonly installInput?: string
  readonly loaderName?: string
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
const registry = new ModuleRegistry(hostSeed)
const storedReader = new StoredPluginModuleReader(pluginFiles)
type Prepared = Awaited<ReturnType<typeof storedReader.prepare>>
const active = new Map<string, { archive: PluginArchiveDB.Archive; prepared: Prepared }>()
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

pluginContext.on(
  'internal/status',
  fiber => {
    const id = findOwner(fiber)
    if (!id) return
    if (fiber.state === pluginFiberStates.FAILED && !internalIds.has(id)) {
      void fiber
        .await()
        .catch(error =>
          pluginStatuses.set(id, {
            state: pluginFiberStates.FAILED,
            source: fiber.name,
            error: describe(error),
          }),
        )
      return
    }
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
      installInput: archive.installInput,
      loaderName: archive.loaderName,
      manifest: isPluginManifest(archive.meta) ? archive.meta : null,
      enabled: archive.enable,
      config: archive.config ?? {},
      origin: 'installed',
    })
  }
}

const mount = async (id: string, override?: readonly Component.Function[]) => {
  const installation = pluginInstallations.get(id)
  if (!installation) throw new Error(`installed plugin not found: ${id}`)
  if (!installation.manifest) throw new TypeError(`invalid plugin manifest: ${id}`)
  let module: LoadedPluginModule
  const builtin = builtinPlugins.find(plugin => plugin.manifest.id === id)
  if (builtin) module = { functions: builtin.functions }
  else {
    const selected = active.get(installation.manifest.package)
    if (!selected) throw new Error(`unregistered installation: ${id}`)
    module = selected.prepared.load(registry)
  }
  if (override) module = { ...module, functions: override }
  loadedModules.set(id, module)
  pluginStatuses.set(id, { state: pluginFiberStates.LOADING })
  const group: Fiber[] = []
  children.set(id, group)
  const fiber = pluginContext.use({
    name: id,
    apply(ctx) {
      owners.set(ctx.fiber, id)
      module.activate?.(ctx)
      for (const fn of module.functions) group.push(ctx.use(fn, installation.config))
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
    await pluginContext.use(ctx => {
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
      const downloader = Downloader.create({ key: 'app:plugins' })
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

function showArchive(archive: PluginArchiveDB.Archive) {
  pluginInstallations.set(archive.pluginName, {
    manifest: isPluginManifest(archive.meta) ? archive.meta : null,
    enabled: archive.enable,
    config: archive.config ?? {},
    origin: 'installed',
    installInput: archive.installInput,
    loaderName: archive.loaderName,
  })
}
function failed(id: string, error: unknown) {
  pluginStatuses.set(id, { state: pluginFiberStates.FAILED, source: id, error: describe(error) })
  pluginDiagnostics.record('error', 'plugin load failed', { pluginId: id, error: describe(error) })
}
async function settle(id: string) {
  await pluginFibers.get(id)?.await()
  await Promise.all((children.get(id) ?? []).map(fiber => fiber.await()))
}
function declared(rows: PluginArchiveDB.Archive[]) {
  return new Map(
    rows
      .filter(row => row.enable && !internalIds.has(row.pluginName) && isPluginManifest(row.meta))
      .map(row => [row.meta.package, row.meta]),
  )
}
export const loadEnabledPlugins = () =>
  managed(async () => {
    await refreshInstallations()
    const rows = await repository.list()
    await pluginFiles.collectRevisions(
      new Set(
        rows.flatMap(row => (row.revision ? [revisionKey(row.pluginName, row.revision)] : [])),
      ),
    )
    const graph = declared(rows)
    const byName = new Map(rows.filter(r => isPluginManifest(r.meta)).map(r => [r.meta.package, r]))
    for (const row of rows) {
      if (!row.enable || internalIds.has(row.pluginName)) continue
      try {
        if (!isPluginManifest(row.meta) || !row.revision) throw new Error('使用新版 SDK 重新构建')
        for (const name of dependencyOrder(graph, [row.meta.package], coreManifest.version)) {
          if (active.has(name)) continue
          const archive = byName.get(name)!
          const prepared = await storedReader.prepare(archive)
          registry.register(prepared.entry)
          active.set(name, { archive, prepared })
        }
      } catch (error) {
        failed(row.pluginName, error)
      }
    }
    for (const [name, { archive }] of active) {
      if (pluginFibers.has(archive.pluginName)) continue
      try {
        dependencyOrder(graph, [name], coreManifest.version)
        await mount(archive.pluginName)
      } catch (error) {
        failed(archive.pluginName, error)
      }
    }
    for (const { archive } of active.values()) {
      try {
        await settle(archive.pluginName)
      } catch (error) {
        await unload(archive.pluginName)
        failed(archive.pluginName, error)
      }
      watchDev(archive)
    }
  })

async function replace(archive: PluginArchiveDB.Archive) {
  const id = archive.pluginName
  const previousInstallation = pluginInstallations.get(id)
  const rows = (await repository.list()).filter(row => row.pluginName !== id)
  const graph = declared([...rows, archive])
  const name = archive.meta.package
  const roots = new Set([name])
  for (const pkg of roots) {
    for (const manifest of graph.values())
      if (Object.hasOwn(manifest.pluginPeers, pkg)) roots.add(manifest.package)
  }
  if (!archive.enable) roots.delete(name)
  const order = dependencyOrder(graph, roots, coreManifest.version)
  const candidate = archive.enable ? await storedReader.prepare(archive) : undefined
  const before = new Map(active)
  const affected = registry.freeze([name])
  async function stop() {
    for (const pkg of affected) {
      const selected = active.get(pkg)
      active.delete(pkg)
      if (selected) await unload(selected.archive.pluginName)
    }
  }
  async function start(pkg: string, selected: NonNullable<ReturnType<typeof active.get>>) {
    active.set(pkg, selected)
    registry.register(selected.prepared.entry)
    showArchive(selected.archive)
    await mount(selected.archive.pluginName)
  }
  async function rollback() {
    registry.freeze(affected)
    try {
      await stop()
      if (previousInstallation) pluginInstallations.set(id, previousInstallation)
      else pluginInstallations.delete(id)
      for (const pkg of [...affected].reverse()) {
        const old = before.get(pkg)
        if (old) await start(pkg, old)
      }
      for (const pkg of affected) {
        const selected = active.get(pkg)
        if (selected) await settle(selected.archive.pluginName)
      }
    } catch (error) {
      registry.freeze(affected)
      await stop()
      for (const pkg of affected) failed(before.get(pkg)?.archive.pluginName ?? id, error)
      throw error
    } finally {
      registry.finish(affected)
    }
  }
  try {
    await stop()
    showArchive(archive)
    for (const pkg of order) {
      if (!affected.includes(pkg)) continue
      const selected =
        pkg === name && candidate ? { archive, prepared: candidate } : before.get(pkg)
      if (selected) await start(pkg, selected)
    }
    for (const pkg of affected) {
      const selected = active.get(pkg)
      if (selected) await settle(selected.archive.pluginName)
    }
  } catch (error) {
    await rollback()
    throw error
  }
  return {
    rollback,
    commit: async () => {
      registry.finish(affected)
      watchDev(archive)
    },
  }
}
export interface PluginInstallOptions {
  readonly report?: PluginInstallReporter
  readonly signal?: AbortSignal
}

export const installPlugin = (input: File | string, options: PluginInstallOptions = {}) =>
  managed(async () =>
    pluginInstaller.install(input, options.signal, options.report, { afterStage: replace }),
  )

export const updatePluginByName = (id: string, options: PluginInstallOptions = {}) =>
  managed(async () => {
    const archive = await repository.find(id)
    if (!archive?.installInput) throw new Error(`plugin has no update source: ${id}`)
    return await pluginInstaller.install(archive.installInput, options.signal, options.report, {
      expectedId: id,
      afterStage: replace,
    })
  })

export const setPluginEnabled = (id: string, enabled: boolean) =>
  managed(async () => {
    if (internalIds.has(id)) throw new Error(`host plugin cannot be disabled: ${id}`)
    const archive = await repository.find(id)
    if (!archive) throw new Error(`installed plugin not found: ${id}`)
    const next = { ...archive, enable: enabled }
    if (!isPluginManifest(archive.meta) && !enabled) {
      await repository.upsert(next)
      showArchive(next)
      return
    }
    await updateRecord(next)
  })

export const setPluginConfig = (id: string, config: Record<string, unknown>) =>
  managed(async () => {
    const archive = await repository.find(id)
    if (!archive) throw new Error(`installed plugin not found: ${id}`)
    const validationRegistry = new ModuleRegistry(hostSeed)
    for (const { prepared } of active.values()) validationRegistry.register(prepared.entry)
    let module = loadedModules.get(id)
    if (!module && !archive.enable) {
      const prepared = await storedReader.prepare(archive)
      validationRegistry.register(prepared.entry)
      module = prepared.load(validationRegistry)
    }
    for (const fn of module?.functions ?? []) {
      resolveConfig(
        {
          callback: (ctx: Context, value: Record<string, unknown>) => fn(ctx, value),
          Config: fn.Config,
          fibers: new DisposableList(),
        },
        config,
      )
    }
    await updateRecord({ ...archive, config })
  })

async function updateRecord(archive: PluginArchiveDB.Archive) {
  const change = await replace(archive)
  try {
    await repository.upsert(archive)
  } catch (error) {
    await change.rollback()
    throw error
  }
  await change.commit()
}
export const uninstallPlugin = (id: string) =>
  managed(async () => {
    if (internalIds.has(id)) throw new Error(`host plugin cannot be uninstalled: ${id}`)
    const row = await repository.find(id)
    if (!row) return
    const change = isPluginManifest(row.meta) ? await replace({ ...row, enable: false }) : undefined
    try {
      await pluginInstaller.uninstall(id)
    } catch (error) {
      await change?.rollback()
      throw error
    }
    await change?.commit()
    pluginInstallations.delete(id)
    pluginStatuses.delete(id)
  })
export const reloadPlugin = (id: string) =>
  managed(async () => {
    const row = await repository.find(id)
    if (!row) throw new Error(`unknown plugin: ${id}`)
    await (await replace(row)).commit()
  })
export const reconnectDevPlugin = updatePluginByName

const watchers = new Map<string, { source: string; events: EventSource }>()
function watchDev(row: PluginArchiveDB.Archive) {
  const id = row.pluginName
  const port = parseDevServerPort(row.installInput)
  const current = watchers.get(id)
  if (
    row.enable &&
    row.loaderName === DEV_SERVER_LOADER_ID &&
    port &&
    current?.source === row.installInput
  )
    return
  current?.events.close()
  watchers.delete(id)
  if (!row.enable || row.loaderName !== DEV_SERVER_LOADER_ID || !port) return
  const events = new EventSource(devServerUrl(port, DEV_EVENTS_PATH))
  watchers.set(id, { source: row.installInput, events })
  let sequence = 0
  let session = ''
  let revision = ''
  let running = false
  events.onopen = () => {
    session = ''
    sequence = 0
  }
  events.onmessage = async message => {
    let event: unknown
    try {
      event = JSON.parse(message.data)
    } catch {
      return
    }
    if (
      watchers.get(id)?.events !== events ||
      !isDevRevision(event) ||
      event.id !== id ||
      (session && session !== event.session) ||
      event.sequence <= sequence
    )
      return
    session = event.session
    sequence = event.sequence
    revision = event.revision
    if (running) return
    running = true
    try {
      while (revision && watchers.get(id)?.events === events) {
        const next = revision
        revision = ''
        await managed(async () => {
          if (watchers.get(id)?.events !== events) return
          const installed = await repository.find(id)
          if (!installed || installed.revision === next) return
          await pluginInstaller.install(installed.installInput, undefined, undefined, {
            expectedId: id,
            expectedRevision: next,
            afterStage: replace,
          })
        }).catch(error =>
          pluginDiagnostics.record('error', 'development update failed', {
            pluginId: id,
            error: describe(error),
          }),
        )
      }
    } catch (error) {
      failed(id, error)
    } finally {
      running = false
    }
  }
}
export const disposePluginHost = async () => {
  for (const watcher of watchers.values()) watcher.events.close()
  watchers.clear()
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

export const resolvePluginIconUrl = async (
  plugin: string | undefined,
  icon: string | undefined,
) => {
  if (!icon) return
  if (/^https?:\/\//i.test(icon)) return icon
  if (!plugin) throw new Error('plugin id is required for a local icon')
  const archive = await repository.find(plugin)
  if (!archive?.revision) return
  return await pluginFiles.createAssetUrl(revisionKey(plugin, archive.revision), icon)
}

export {
  getTauriPluginRoot,
  pluginI18n,
  type PluginI18nAdapter,
  type PluginLocaleMessages,
} from './adapters'