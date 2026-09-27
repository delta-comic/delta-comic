import { defineCapability, type CapabilityModule } from '../kernel'

export const createLifecycleCapability = (): CapabilityModule =>
  defineCapability({
    id: 'lifecycle',
    select: config => {
      const hooks = config.hooks
      return hooks?.onBooted || hooks?.onUnload ? hooks : undefined
    },
    async activate(hooks, context) {
      if (hooks.onUnload) context.scope.defer(() => hooks.onUnload?.())
      await hooks.onBooted?.()
    },
  })