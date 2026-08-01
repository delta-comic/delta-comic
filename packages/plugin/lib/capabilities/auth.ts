import { defineCapability, type CapabilityModule } from '../kernel'

import type { PluginCapabilityServices } from './services'

export const createAuthCapability = (services: PluginCapabilityServices): CapabilityModule =>
  defineCapability({
    id: 'auth',
    select: config => config.model?.user?.auth,
    async activate(auth, context) {
      if (services.phase === 'preboot') {
        throw new Error('plugin authentication is only available during normal activation')
      }
      if (!services.auth) throw new Error('plugin authentication requires a host auth gateway')
      context.report({ name: 'auth', description: 'checking authentication' })
      await services.auth.authenticate(context.owner, auth, context.signal)
    },
  })