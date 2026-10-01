import { defineCapability, type CapabilityModule } from '@delta-comic/plugin-kernel'

import type { DCPluginConfig } from '../api'

import type { PluginCapabilityServices } from './services'

export const createI18nCapability = (
  services: PluginCapabilityServices,
): CapabilityModule<DCPluginConfig> =>
  defineCapability({
    id: 'i18n',
    select: config => config.i18n,
    activate(messages, context) {
      services.i18n.register(context.scope.owner, messages)
      context.scope.defer(() => services.i18n.remove(context.scope.owner))
      return true
    },
  })