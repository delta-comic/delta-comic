import { defineCapability, type CapabilityModule } from '../kernel'

export const createSpecialCapability = (): CapabilityModule =>
  defineCapability({
    id: 'special',
    select: config => config.model?.special,
    async activate(steps, context) {
      for (const step of steps) {
        context.signal.throwIfAborted()
        if (!step.name) throw new Error('special step name cannot be empty')
        context.report({ name: step.name, description: '' })
        await step.call(description => context.report({ name: step.name, description }))
      }
    },
  })