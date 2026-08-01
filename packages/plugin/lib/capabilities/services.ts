import type { App } from 'vue'

import type { ConfigPointer, PluginLocaleMessages } from '../api'
import type { ContributionHub } from '../kernel'

export interface RegisteredPluginConfig {
  readonly ready: Promise<void>
}

export interface PluginConfigRegistry {
  register(pointer: ConfigPointer): RegisteredPluginConfig
  unregister(pointer: ConfigPointer): void
}

export interface PluginMessageRegistry {
  register(plugin: string, messages: PluginLocaleMessages): void
  remove(plugin: string): void
}

export interface PluginCapabilityServices {
  readonly app?: App
  readonly config: PluginConfigRegistry
  readonly contributions: ContributionHub
  readonly i18n: PluginMessageRegistry
  readonly phase: 'normal' | 'preboot'
}