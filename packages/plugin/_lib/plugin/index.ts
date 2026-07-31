import { isFunction } from 'es-toolkit/compat'
import type { App } from 'vue'

import type { ConfigPointer } from '@/configPointer'
import type { PluginLocaleMessages } from '@/i18n'

import type * as Share from './share'
export type * as Share from './share'

import type * as Content from './content'
export type * as Content from './content'

import type * as Subscribe from './subscribe'
export type * as Subscribe from './subscribe'

import type * as User from './user'
export type * as User from './user'

import type * as Api from './api'
export type * as Api from './api'

import type * as OtherProgress from './otherProgress'
export type * as OtherProgress from './otherProgress'

import type * as Search from './search'
export type * as Search from './search'

import type * as Auth from './auth'
export type * as Auth from './auth'

import type { PluginArchiveDB } from '@delta-comic/db'

import type * as Resource from './resource'
export type * as Resource from './resource'

export interface PluginConfigValues {
  name: string
  content?: Content.Config
  resource?: Resource.Content
  api?: Record<string, Api.Config>
  user?: User.Config
  auth?: Auth.Config
  /** Locale messages are merged in plugin load order; later plugins may override existing keys. */
  i18n?: PluginLocaleMessages
  otherProgress?: OtherProgress.Config[]
  search?: Search.Config
  /**
   * 插件的配置项需在此处注册
   * 传入`Store.ConfigPointer`
   */
  config?: ConfigPointer[]
  subscribe?: Record<string, Subscribe.Config>
  share?: Share.Config
}

export type DefineResult = { api?: Record<string, string | undefined | false> }
export type Platform = 'tauri' | 'web'
export interface PluginConfigHooks {
  /** Runs after app.use() registration and before app.mount() for preboot plugins. */
  onPreboot?(context: {
    app: App
    platform: Platform
    safe: boolean
  }): (() => Promise<void> | void) | Promise<(() => Promise<void> | void) | void> | void
  /**
   * 返回值如果不为空，则会await后作为expose暴露
   */
  onBooted?(ins: DefineResult): (PromiseLike<object> | object) | void
  /** Runs before a normal plugin is reloaded or the runtime is disposed. */
  onUnload?(): Promise<void> | void
  /** Runs once before an installed plugin and its persisted files are removed. */
  onUninstall?(): Promise<void> | void
}

export type PluginConfig = PluginConfigValues & PluginConfigHooks

export interface ConfigEnv {
  safe: boolean
  platform: Platform
}
/**
 * 这仅是个辅助定义的函数，没有副作用
 */
export const definePlugin = <T extends PluginConfig>(
  config: T | PluginConfigFactory<T>,
): PluginConfigFactory<T> => {
  if (isFunction(config)) return config
  return () => config
}

export type PluginExpose<T extends PluginConfig> = ReturnType<
  T['onBooted'] extends () => object ? T['onBooted'] : () => void
>

export type PluginConfigFactory<T extends PluginConfig = PluginConfig> = (env: ConfigEnv) => T

export interface BuiltInPluginDefinition<T extends PluginConfig = PluginConfig> {
  meta: PluginArchiveDB.Meta
  config: PluginConfigFactory<T>
  enabledByDefault?: boolean
}

/** Defines a trusted plugin that is bundled with the application. */
export const defineInnerPlugin = <T extends PluginConfig>(definition: BuiltInPluginDefinition<T>) =>
  definition