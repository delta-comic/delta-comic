import type { PluginConfig, PluginConfigFactory } from '@delta-comic/plugin-api'
import type { LoadedPluginModule } from '@delta-comic/plugin-loader'
import type { PluginManifest } from '@delta-comic/plugin-manifest'

export type PluginOrigin = 'builtin' | 'installed'

export interface PluginManagementCapabilities {
  canDisable?: boolean
  canUninstall?: boolean
  canUpdate?: boolean
}

export interface PluginCandidate<TConfig extends PluginConfig = PluginConfig> {
  readonly manifest: PluginManifest
  readonly origin: PluginOrigin
  readonly enabled: boolean
  readonly management: PluginManagementCapabilities
  load(signal: AbortSignal): Promise<LoadedPluginModule<TConfig>>
}

export interface PluginCandidateProvider<TConfig extends PluginConfig = PluginConfig> {
  readonly id: string
  list(signal: AbortSignal): Promise<PluginCandidate<TConfig>[]>
}

export interface InternalPluginDefinition<TConfig extends PluginConfig = PluginConfig> {
  readonly manifest: PluginManifest
  readonly factory: PluginConfigFactory<TConfig>
  readonly canDisable?: boolean
  readonly enabledByDefault?: boolean
}

export const defineInternalPlugin = <TConfig extends PluginConfig>(
  definition: InternalPluginDefinition<TConfig>,
) => definition