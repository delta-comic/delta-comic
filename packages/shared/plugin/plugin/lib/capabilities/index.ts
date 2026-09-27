import type { CapabilityModule } from '../kernel'

import { createAuthCapability } from './auth'
import { createConfigCapability } from './config'
import { createContentCapability } from './content'
import { createI18nCapability } from './i18n'
import { createLifecycleCapability } from './lifecycle'
import { createModelCapability } from './model'
import { createRemoteCapability } from './remote'
import type { PluginCapabilityServices } from './services'
import { createSpecialCapability } from './special'
import { createUserCapability } from './user'

export * from './auth'
export * from './channels'
export * from './config'
export * from './content'
export * from './i18n'
export * from './lifecycle'
export * from './model'
export * from './remote'
export * from './services'
export * from './special'
export * from './user'

/** Fixed host-owned activation topology. Third-party plugins only provide data to it. */
export const createDefaultCapabilities = (
  services: PluginCapabilityServices,
): readonly CapabilityModule[] => [
  createConfigCapability(services),
  createI18nCapability(services),
  createModelCapability(services),
  createContentCapability(),
  createUserCapability(),
  createRemoteCapability(services),
  createAuthCapability(services),
  createSpecialCapability(),
  createLifecycleCapability(),
]