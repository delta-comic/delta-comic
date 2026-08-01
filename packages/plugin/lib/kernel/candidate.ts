import type { PluginManifest } from '@delta-comic/model'

import type { PluginConfigFactory } from '../api'

export type PluginOrigin = 'builtin' | 'installed'

export interface PluginManagementCapabilities {
  readonly canDisable: boolean
  readonly canUninstall: boolean
  readonly canUpdate: boolean
}

export interface PluginCandidate {
  readonly manifest: PluginManifest
  readonly origin: PluginOrigin
  readonly enabled: boolean
  readonly management: PluginManagementCapabilities
  load(signal: AbortSignal): Promise<PluginConfigFactory>
}

export interface InternalPluginDefinition {
  readonly manifest: PluginManifest
  readonly factory: PluginConfigFactory
  readonly enabledByDefault?: boolean
}

export const defineInternalPlugin = <T extends InternalPluginDefinition>(definition: T) =>
  definition