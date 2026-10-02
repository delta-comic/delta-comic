import { defineCapability, type CapabilityModule } from '@delta-comic/plugin-kernel'

import type { DCPluginConfig } from '../api'

import type { PluginCapabilityServices } from './services'

export const createAuthCapability = (
  services: PluginCapabilityServices,
): CapabilityModule<DCPluginConfig> =>
  defineCapability({
    id: 'auth',
    select: config => config.model?.user?.auth,
    async activate(auth, context) {
      if (!services.auth) throw new Error('plugin authentication requires a host auth gateway')
      await services.auth.authenticate(context.owner, auth, context.signal)
      return true
    },
  })