import type { PluginManifest } from '@delta-comic/model'

import type { PluginConfigFactory } from '../api'

import type { PluginScope } from './scope'

export type PluginOrigin = 'builtin' | 'installed'

export interface PluginManagementCapabilities {
  readonly canDisable: boolean
  readonly canUninstall: boolean
  readonly canUpdate: boolean
}

export interface LoadedPluginModule {
  readonly factory: PluginConfigFactory
  activate?(scope: PluginScope): Promise<void> | void
  dispose?(): Promise<void> | void
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
  list(signal: AbortSignal): Promise<readonly PluginCandidate[]>
}

export interface InternalPluginDefinition {
  readonly manifest: PluginManifest
  readonly factory: PluginConfigFactory
  readonly canDisable?: boolean
  readonly enabledByDefault?: boolean
}

export const defineInternalPlugin = <T extends InternalPluginDefinition>(definition: T) =>
  definition