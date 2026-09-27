import { UniUser } from '@delta-comic/model'

import { defineCapability, type CapabilityModule } from '../kernel'

import { bindRegistryValue } from './registryBinding'

export const createUserCapability = (): CapabilityModule =>
  defineCapability({
    id: 'user-bindings',
    select: config => config.model?.user,
    activate(user, context) {
      bindRegistryValue(context.scope, UniUser.userCards, context.owner, user.card)
      bindRegistryValue(context.scope, UniUser.userEditorBase, context.owner, user.edit)
    },
  })