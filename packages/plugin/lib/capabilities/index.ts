import type { CapabilityModule } from '../kernel'

import { createConfigCapability } from './config'
import { createI18nCapability } from './i18n'
import { createLifecycleCapability } from './lifecycle'
import { createModelCapability } from './model'
import type { PluginCapabilityServices } from './services'

export * from './channels'
export * from './config'
export * from './i18n'
export * from './lifecycle'
export * from './model'
export * from './services'

/** Fixed host-owned activation topology. Third-party plugins only provide data to it. */
export const createDefaultCapabilities = (
  services: PluginCapabilityServices,
): readonly CapabilityModule[] => [
  createConfigCapability(services),
  createI18nCapability(services),
  createModelCapability(services),
  createLifecycleCapability(services),
]