import type { PluginConfig, PluginConfigFactory } from '@delta-comic/plugin-api'
import type { PluginManifest } from '@delta-comic/plugin-manifest'

export interface PluginScopeLike {
  readonly owner: string
  readonly signal: AbortSignal
  defer(disposer: () => void | Promise<void>): void | (() => void | Promise<void>)
}

export interface LoadedPluginModule<TConfig extends PluginConfig = PluginConfig> {
  readonly factory: PluginConfigFactory<TConfig>
  readonly activate?: (scope: PluginScopeLike) => void | Promise<void>
  readonly dispose?: () => void | Promise<void>
}

export interface PluginModuleReaderInput {
  readonly manifest: PluginManifest
  readonly source: string
}

export interface PluginModuleReader<TConfig extends PluginConfig = PluginConfig> {
  readonly id: string
  matches?(input: PluginModuleReaderInput): boolean | Promise<boolean>
  read(input: PluginModuleReaderInput, signal?: AbortSignal): Promise<LoadedPluginModule<TConfig>>
}