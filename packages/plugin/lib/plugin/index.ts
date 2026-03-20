import { isString, isUndefined } from 'es-toolkit'
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

export interface PluginConfig {
  name: string
  content?: Content.Config
  resource?: Resource.Content
  api?: Record<string, Api.Config>
  user?: User.Config
  auth?: Auth.Config
  otherProgress?: OtherProgress.Config[]
  /**
   * 返回值如果不为空，则会await后作为expose暴露
   */
  onBooted?(ins: DefineResult): (PromiseLike<object> | object) | void
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

export const definePlugin = async <T extends PluginConfig>(
  config: T | ((safe: boolean) => T)
): Promise<T> => {
  if (isFunction(config)) var cfg = config(window.$$safe$$)
  else var cfg = config
  console.log('[definePlugin] new plugin defining...', cfg)
  await pluginEmitter.emit('definedPlugin', cfg)
  return cfg
}
export type PluginExpose<T extends () => Promise<PluginConfig>> = Awaited<
  ReturnType<NonNullable<Awaited<ReturnType<T>>['onBooted']>>
>

export interface RawPluginMeta {
  'name:display': string
  'name:id': string
  'version': string
  'author': string | undefined
  'description': string
  'require'?: string[] | string
}

export interface PluginMeta {
  name: { display: string; id: string }
  version: { plugin: string; supportCore: string }
  author: string
  description: string
  require: { id: string; download?: string | undefined }[]
  entry?: { jsPath: string; cssPath?: string }
  beforeBoot?: { path: string; slot: string }[]
}

export const decodePluginMeta = (v: RawPluginMeta): PluginMeta => ({
  name: { display: v['name:display'], id: v['name:id'] },
  author: v.author ?? '',
  description: v.description,
  require: (v.require ? (isString(v.require) ? [v.require] : v.require) : [])
    .map(dep => {
      const [name, ...download] = dep.split(':')
      if (!name.startsWith('dc|')) return
      return { id: name.replace(/^dc\|/, ''), download: download.join(':') }
    })
    .filter(v => !isUndefined(v)),
  version: {
    plugin: v.version.split('/')[0],
    supportCore: (() => {
      const raw = v.version.split('/')[1]
      if (v.version.split('/')[2]) {
        return raw.replaceAll('>=', '^')
      }
      return raw
    })()
  }
})