import { defineCapability, type CapabilityModule } from '@delta-comic/plugin-kernel'

import type { DCPluginConfig } from '../api'

export const createLifecycleCapability = (): CapabilityModule<DCPluginConfig> =>
  defineCapability({
    id: 'lifecycle',
    select: config => {
      const hooks = config.hooks
      return hooks?.onBooted || hooks?.onUnload ? hooks : undefined
    },
    async activate(hooks, context) {
      if (hooks.onUnload) context.scope.defer(() => hooks.onUnload?.())
      await hooks.onBooted?.()
      return true
    },
  })