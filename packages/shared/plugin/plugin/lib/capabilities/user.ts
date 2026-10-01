import { UniUser } from '@delta-comic/model'
import { defineCapability, type CapabilityModule } from '@delta-comic/plugin-kernel'

import type { DCPluginConfig } from '../api'

import { bindRegistryValue } from './registryBinding'

export const createUserCapability = (): CapabilityModule<DCPluginConfig> =>
  defineCapability({
    id: 'user-bindings',
    select: config => config.model?.user,
    activate(user, context) {
      bindRegistryValue(context.scope, UniUser.userCards, context.owner, user.card)
      bindRegistryValue(context.scope, UniUser.userEditorBase, context.owner, user.edit)
      return true
    },
  })