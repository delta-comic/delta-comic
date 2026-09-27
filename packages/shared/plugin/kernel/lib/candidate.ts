import type { PluginConfigFactory } from '@delta-comic/plugin-api'
import type { LoadedPluginModule } from '@delta-comic/plugin-loader'
import type { PluginManifest } from '@delta-comic/plugin-manifest'

export type PluginOrigin = 'builtin' | 'installed'

export interface PluginManagementCapabilities {
  canDisable?: boolean
  canUninstall?: boolean
  canUpdate?: boolean
}

export interface PluginCandidate {
  readonly manifest: PluginManifest
  readonly origin: PluginOrigin
  readonly enabled: boolean
  readonly management: PluginManagementCapabilities
  load(signal: AbortSignal): Promise<LoadedPluginModule>
}

export interface PluginCandidateProvider {
  readonly id: string
  list(signal: AbortSignal): Promise<PluginCandidate[]>
}

export interface InternalPluginDefinition {
  readonly manifest: PluginManifest
  readonly factory: PluginConfigFactory
  readonly canDisable?: boolean
  readonly enabledByDefault?: boolean
}

export const defineInternalPlugin = (definition: InternalPluginDefinition) => definition