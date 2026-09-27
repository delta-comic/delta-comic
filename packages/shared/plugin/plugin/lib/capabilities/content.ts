import { UniComment, UniContentPage, UniItem } from '@delta-comic/model'

import { defineCapability, type CapabilityModule } from '../kernel'

import { bindRegistryValue } from './registryBinding'

export const createContentCapability = (): CapabilityModule =>
  defineCapability({
    id: 'content-bindings',
    select: config => config.model?.content?.models,
    activate(models, context) {
      const names = new Set<string>()
      for (const model of models) {
        if (!model.name) throw new Error('content model name cannot be empty')
        if (names.has(model.name)) throw new Error(`duplicate content model "${model.name}"`)
        names.add(model.name)
        const key: [plugin: string, name: string] = [context.owner, model.name]
        bindRegistryValue(context.scope, UniContentPage.layouts, key, model.Layout)
        bindRegistryValue(context.scope, UniItem.itemCards, key, model.ItemCard)
        bindRegistryValue(context.scope, UniContentPage.contentPages, key, model.ContentPage)
        bindRegistryValue(
          context.scope,
          UniContentPage.downloadProviders,
          key,
          model.DownloadProvider,
        )
        bindRegistryValue(context.scope, UniComment.commentRow, key, model.CommentRow)
        bindRegistryValue(context.scope, UniItem.itemTranslator, key, model.ItemTranslator)
      }
    },
  })