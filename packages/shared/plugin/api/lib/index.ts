import type { PluginManifest } from '@delta-comic/plugin-manifest'
import type { Context, Plugin } from 'cordis'

export type CordisPlugin = Plugin

export interface PluginContract {
  manifest: PluginManifest
  entry: CordisPlugin
}

export interface PluginContextFactory {
  create(manifest: PluginManifest): Context
}

export interface PluginConfig {
  readonly name: string
  readonly config?: Record<string, unknown>
  readonly i18n?: PluginLocaleMessages
  readonly model?: Record<string, unknown>
  readonly hooks?: PluginHooks
}

export interface PluginLocaleMessage {
  readonly [key: string]: string | PluginLocaleMessage
}

export type PluginLocaleMessages = Record<string, PluginLocaleMessage>

export interface PluginHooks {
  readonly onPreboot?: (context: {
    readonly app: unknown
  }) => void | (() => void | Promise<void>) | Promise<void | (() => void | Promise<void>)>
  readonly onUninstall?: () => void | Promise<void>
}

export interface PluginConfigEnvironment {
  readonly platform: string
}

export type PluginConfigFactory<T extends PluginConfig = PluginConfig> = (
  environment: PluginConfigEnvironment,
) => T

export const definePluginContract = (
  manifest: PluginManifest,
  entry: CordisPlugin,
): PluginContract => ({ manifest, entry })