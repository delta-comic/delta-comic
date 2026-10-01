import { defineCapability, type CapabilityModule } from '@delta-comic/plugin-kernel'

import type { DCPluginConfig } from '../api'

export const createSpecialCapability = (): CapabilityModule<DCPluginConfig> =>
  defineCapability({
    id: 'special',
    select: config => config.model?.special,
    async activate(steps, context) {
      for (const step of steps) {
        context.signal.throwIfAborted()
        if (!step.name) throw new Error('special step name cannot be empty')
        await step.call(() => {})
      }
      return true
    },
  })