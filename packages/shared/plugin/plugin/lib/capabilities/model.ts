import type { PluginConfigModel } from '../api/model'
import { defineCapability, type CapabilityModule, type ContributionChannel } from '../kernel'

import { pluginModelChannels } from './channels'
import type { PluginCapabilityServices } from './services'

export const createModelCapability = (services: PluginCapabilityServices): CapabilityModule =>
  defineCapability({
    id: 'model',
    select: config => config.model,
    activate(model: PluginConfigModel, context) {
      const register = <T>(channel: ContributionChannel<T>, value: T | undefined) => {
        if (value !== undefined) {
          services.contributions.register(context.scope, channel, 'default', value)
        }
      }

      register(pluginModelChannels.content, model.content)
      register(pluginModelChannels.expose, model.expose)
      register(pluginModelChannels.remote, model.remotes)
      register(pluginModelChannels.social, model.social)
      register(pluginModelChannels.special, model.special)
      register(pluginModelChannels.user, model.user)
    },
  })