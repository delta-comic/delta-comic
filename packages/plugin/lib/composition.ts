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
  reservedIds: new Set(internalPluginDefinitions.map(definition => definition.manifest.name.id)),
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
  const archive = await pluginInstaller.install(input, options.signal, options.report)
  pluginRuntime.markRestartRequired(archive.pluginName)
  await pluginRuntime.refreshCandidates()
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
  if (candidate.origin === 'builtin') await internalPreferences.setEnabled(plugin, enabled)
  else {
    const archive = await pluginRepository.find(plugin)
    if (!archive) throw new Error(`installed plugin not found: ${plugin}`)
    await pluginRepository.upsert({ ...archive, enable: enabled })
  }
  pluginRuntime.markRestartRequired(plugin)
  await pluginRuntime.refreshCandidates()
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