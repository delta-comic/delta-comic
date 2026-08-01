import { defineCapability, type CapabilityModule } from '../kernel'

import type { PluginCapabilityServices } from './services'

export const createLifecycleCapability = (services: PluginCapabilityServices): CapabilityModule =>
  defineCapability({
    id: 'lifecycle',
    select: config => {
      const hooks = config.hooks
      return hooks?.onBooted || hooks?.onPreboot || hooks?.onUnload || hooks?.onUninstall
        ? hooks
        : undefined
    },
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