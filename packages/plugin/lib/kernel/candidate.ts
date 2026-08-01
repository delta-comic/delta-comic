import type { PluginArchiveDB } from '@delta-comic/db'

import type { PluginConfigFactory } from '../export'

export type PluginOrigin = 'builtin' | 'installed'

export interface PluginManagementCapabilities {
  readonly canDisable: boolean
  readonly canUninstall: boolean
  readonly canUpdate: boolean
}

export interface PluginCandidate {
  readonly manifest: PluginArchiveDB.Meta
  readonly origin: PluginOrigin
  readonly enabled: boolean
  readonly management: PluginManagementCapabilities
  load(signal: AbortSignal): Promise<PluginConfigFactory>
}

export interface InternalPluginDefinition {
  readonly manifest: PluginArchiveDB.Meta
  readonly factory: PluginConfigFactory
  readonly enabledByDefault?: boolean
}

export const defineInternalPlugin = <T extends InternalPluginDefinition>(definition: T) =>
  definition