import type { PluginConfigHooks } from './hook'
export type * from './hook'
import type { PluginConfigModel } from './model'
export type * from './model'

export interface DCPluginConfig {
  model: PluginConfigModel
  hooks: PluginConfigHooks
}