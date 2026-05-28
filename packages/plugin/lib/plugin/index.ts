import { isFunction } from 'es-toolkit/compat'

import type { ConfigPointer } from '@/config'

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

import mitt from 'mitt'

import type * as Resource from './resource'
export type * as Resource from './resource'

export const pluginEmitter = mitt<{ definedPlugin: PluginConfig }>()

export interface PluginConfigValues {
  name: string
  content?: Content.Config
  resource?: Resource.Content
  api?: Record<string, Api.Config>
  user?: User.Config
  auth?: Auth.Config
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
export interface PluginConfigHooks {
  /**
   * 返回值如果不为空，则会await后作为expose暴露
   */
  onBooted?(ins: DefineResult): (PromiseLike<object> | object) | void
}

export type PluginConfig = PluginConfigValues & PluginConfigHooks

export interface ConfigEnv {
  safe: boolean
}
/**
 * 这仅是个辅助定义的函数，没有副作用
 */
export const definePlugin = <T extends PluginConfig>(
  config: T | ((env: ConfigEnv) => T),
): ((env: ConfigEnv) => T) => {
  if (isFunction(config)) return config
  return () => config
}

export type PluginExpose<T extends PluginConfig> = ReturnType<
  T['onBooted'] extends () => object ? T['onBooted'] : () => void
>

export type PluginConfigFactory = (env: ConfigEnv) => PluginConfig
