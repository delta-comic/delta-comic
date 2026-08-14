import { isTauri } from '@tauri-apps/api/core'

import {
  AwesomeRegistryClient,
  ConfigStore,
  createDefaultPluginFileStore,
  pluginI18n,
} from './adapters'
import { corePluginDefinition, internalPluginDefinitions } from './builtins'
import { createDefaultCapabilities, type PluginAuthGateway } from './capabilities'
import { cfg } from './core/config'
import {
  DatabasePluginArchiveRepository,
  DevScriptCodec,
  GitHubSourceResolver,
  HttpSourceResolver,
  InstalledPluginCandidateProvider,
  LocalFileSourceResolver,
  MarketplaceSourceResolver,
  type PluginCatalog,
  type PluginInstallReporter,
  PluginInstallService,
  StoredPluginModuleReader,
  ZipPackageCodec,
} from './install'
import { ContributionHub } from './kernel'
import {
  CompositePluginCandidateProvider,
  InternalPluginCandidateProvider,
  LocalInternalPluginPreferences,
  PluginRuntime,
  PluginStore,
} from './runtime'

export const pluginContributions = new ContributionHub()
export const pluginStore = new PluginStore(value =>
  value.startsWith('i18n:') ? pluginI18n.translate(value.slice('i18n:'.length)) : value,
)
export const pluginConfigStore = new ConfigStore()
export const useConfig = () => pluginConfigStore

export const preparePluginHost = async () => {
  await pluginConfigStore.register(cfg).ready
}

export interface PluginHostServices {
  readonly auth?: PluginAuthGateway
}

const pluginHostServices: PluginHostServices = {}

/** Install host-only integrations without exposing UI or platform details to the runtime kernel. */
export const configurePluginHost = (services: PluginHostServices) => {
  Object.assign(pluginHostServices, services)
}

const pluginFiles = createDefaultPluginFileStore()
const pluginRepository = new DatabasePluginArchiveRepository()
const pluginReader = new StoredPluginModuleReader(pluginFiles)
const internalPreferences = new LocalInternalPluginPreferences()
const internalPluginIds = new Set(
  internalPluginDefinitions.map(definition => definition.manifest.name.id),
)
const internalProvider = new InternalPluginCandidateProvider(
  internalPluginDefinitions,
  internalPreferences,
)
const candidateProvider = new CompositePluginCandidateProvider([
  internalProvider,
  new InstalledPluginCandidateProvider(pluginRepository, pluginReader),
])

const httpSource = new HttpSourceResolver()
const githubSource = new GitHubSourceResolver({
  coreVersion: corePluginDefinition.manifest.version.plugin,
  includePrereleases: () =>
    pluginConfigStore.has(cfg) &&
    pluginConfigStore.load(cfg).data.value.receivePerReleaseUpdate === true,
})
const awesomeRegistry = new AwesomeRegistryClient()
const marketplaceSource = new MarketplaceSourceResolver(awesomeRegistry, [githubSource, httpSource])

export const pluginCatalog: PluginCatalog = awesomeRegistry

export const pluginInstaller = new PluginInstallService({
  codecs: [new ZipPackageCodec(), new DevScriptCodec()],
  files: pluginFiles,
  repository: pluginRepository,
  reservedIds: internalPluginIds,
  resolvers: [new LocalFileSourceResolver(), marketplaceSource, githubSource, httpSource],
})

export const pluginRuntime = new PluginRuntime({
  capabilities: () =>
    createDefaultCapabilities({
      auth: pluginHostServices.auth,
      config: pluginConfigStore,
      contributions: pluginContributions,
      i18n: pluginI18n,
    }),
  environment: () => ({ platform: isTauri() ? 'tauri' : 'web' }),
  provider: candidateProvider,
  remove: plugin => pluginInstaller.uninstall(plugin),
  store: pluginStore,
})

export interface PluginInstallOptions {
  readonly report?: PluginInstallReporter
  readonly signal?: AbortSignal
}

export const installPlugin = async (input: File | string, options: PluginInstallOptions = {}) => {
  const installed = new Set([
    ...internalPluginIds,
    ...(await pluginRepository.list()).map(archive => archive.pluginName),
  ])
  const archive = await pluginInstaller.install(input, options.signal, options.report)
  await pluginRuntime.refreshCandidates()
  try {
    // Files and metadata are already persisted; load the result immediately so installs and
    // updates work without an application restart. reloadPlugin also reloads prepared dependents.
    await pluginRuntime.reloadPlugin(archive.pluginName)
  } catch (error) {
    // Loading failed: keep a restart hint so a restart retries with the persisted state.
    for (const candidate of pluginRuntime.store.candidates.values()) {
      const plugin = candidate.manifest.name.id
      if (plugin === archive.pluginName || !installed.has(plugin)) {
        pluginRuntime.markRestartRequired(plugin)
      }
    }
    throw new Error(
      `plugin installed but failed to start: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  return archive
}

export const updatePlugin = async (
  archive: { installInput: string },
  options?: PluginInstallOptions,
) => {
  if (!archive.installInput) throw new Error('plugin has no reusable install source')
  return await installPlugin(archive.installInput, options)
}

export const updatePluginByName = async (plugin: string, options?: PluginInstallOptions) => {
  const archive = await pluginRepository.find(plugin)
  if (!archive) throw new Error(`installed plugin not found: ${plugin}`)
  return await updatePlugin(archive, options)
}

export const setPluginEnabled = async (plugin: string, enabled: boolean) => {
  const candidate = pluginStore.candidates.get(plugin)
  if (!candidate?.management.canDisable) throw new Error(`plugin "${plugin}" cannot be disabled`)
  const persist = async () => {
    if (candidate.origin === 'builtin') await internalPreferences.setEnabled(plugin, enabled)
    else {
      const archive = await pluginRepository.find(plugin)
      if (!archive) throw new Error(`installed plugin not found: ${plugin}`)
      await pluginRepository.upsert({ ...archive, enable: enabled })
    }
  }
  const restore = async () => {
    if (candidate.origin === 'builtin')
      await internalPreferences.setEnabled(plugin, candidate.enabled)
    else {
      const archive = await pluginRepository.find(plugin)
      if (archive) await pluginRepository.upsert({ ...archive, enable: candidate.enabled })
    }
    await pluginRuntime.refreshCandidates()
  }

  if (enabled) {
    await persist()
    await pluginRuntime.refreshCandidates()
    try {
      await pluginRuntime.enablePlugin(plugin)
    } catch (error) {
      // Enabling failed; restore the persisted flag so the list matches the runtime state.
      await restore()
      throw error
    }
    pluginRuntime.restartRequired.delete(plugin)
    return
  }

  // Disable validates (dependencies, management) and unloads first, then the flag is persisted.
  await pluginRuntime.disablePlugin(plugin)
  await persist()
  await pluginRuntime.refreshCandidates()
  pluginRuntime.restartRequired.delete(plugin)
}

export const uninstallPlugin = async (plugin: string) => await pluginRuntime.uninstall(plugin)

export const resolvePluginIconUrl = async (
  plugin: string | undefined,
  icon: string | undefined,
) => {
  if (!icon) return undefined
  if (/^https?:\/\//i.test(icon)) return icon
  if (!plugin) throw new Error('a plugin id is required to resolve a local plugin icon')
  return await pluginFiles.createAssetUrl(plugin, icon)
}

export {
  pluginI18n,
  pluginMessageKey,
  translatePluginText,
  type PluginI18nAdapter,
  type PluginLocaleMessages,
} from './adapters'

export const usePluginStore = () => pluginStore