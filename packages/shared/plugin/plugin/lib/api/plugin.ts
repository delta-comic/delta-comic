import { isFunction } from 'es-toolkit'

import type { ConfigPointer } from './config'
import type { ConfigEnv } from './env'
import type { PluginConfigHooks } from './hook'
import type { PluginLocaleMessages } from './i18n'
import type { PluginConfigModel } from './model'

export interface DCPluginConfig {
  /** Stable plugin id. It must equal the candidate manifest id. */
  name: string
  /** At most one declarative configuration form can be contributed by a plugin. */
  config?: ConfigPointer
  i18n?: PluginLocaleMessages
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