import { defineCapability, type CapabilityModule } from '../kernel'

import type { PluginCapabilityServices } from './services'

export const createConfigCapability = (services: PluginCapabilityServices): CapabilityModule =>
  defineCapability({
    id: 'config',
    select: config => config.config,
    async activate(pointer, context) {
      if (pointer.pluginName !== context.scope.owner) {
        throw new Error(
          `plugin config owner mismatch: ${context.scope.owner} / ${pointer.pluginName}`,
        )
      }
      context.report({ description: pointer.configName })
      const registered = services.config.register(pointer)
      context.scope.defer(() => services.config.unregister(pointer))
      await registered.ready
    },
  })