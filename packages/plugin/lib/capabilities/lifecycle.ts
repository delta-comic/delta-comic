import { defineCapability, type CapabilityModule } from '../kernel'

import type { PluginCapabilityServices } from './services'

export const createLifecycleCapability = (services: PluginCapabilityServices): CapabilityModule =>
  defineCapability({
    id: 'lifecycle',
    select: config => config.hooks,
    async activate(hooks, context) {
      if (hooks.onUnload) context.scope.defer(() => hooks.onUnload?.())

      if (services.phase === 'preboot') {
        if (!services.app) throw new Error('preboot activation requires a Vue app')
        const cleanup = await hooks.onPreboot?.({ app: services.app })
        if (cleanup) context.scope.defer(cleanup)
        return
      }
      await hooks.onBooted?.()
    },
  })