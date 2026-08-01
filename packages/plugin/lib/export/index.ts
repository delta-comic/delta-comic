import type { PluginConfigHooks } from './hook'
export type * from './hook'
import type { PluginConfigModel } from './model'
export type * from './model'

import { isFunction } from 'es-toolkit'

import type { ConfigEnv } from './env'

export interface DCPluginConfig {
  name: string
  i18nName: string
  model?: PluginConfigModel
  hooks?: PluginConfigHooks
}

export type PluginConfigFactory<T extends DCPluginConfig = DCPluginConfig> = (env: ConfigEnv) => T

export const defineDeltaComicPlugin = <T extends DCPluginConfig>(
  config: T | PluginConfigFactory<T>,
): PluginConfigFactory<T> => {
  if (isFunction(config)) return config
  return () => config
}