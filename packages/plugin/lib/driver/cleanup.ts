import { uni } from '@delta-comic/model'

import { useConfig } from '@/config'
import { declareDepType, defaultDependencyRegistry } from '@/depends'
import { Global } from '@/global'
import { pluginI18n } from '@/i18n'
import type { PluginConfig } from '@/plugin'

import { releasePluginObjectUrls } from './init/storage'
import { usePluginStore } from './store'

const removeSourcedEntries = (
  map: { keys(): IterableIterator<string>; delete(key: string): boolean },
  plugin: string,
) => {
  for (const key of map.keys()) {
    if (key.split(':', 1)[0] === plugin) map.delete(key)
  }
}

export const cleanupPlugin = (config: PluginConfig) => {
  const plugin = config.name
  const errors: unknown[] = []
  const attempt = (action: () => void) => {
    try {
      action()
    } catch (error) {
      errors.push(error)
    }
  }

  attempt(() => Global.tabbar.delete(plugin))
  attempt(() => Global.categories.delete(plugin))
  attempt(() => Global.barcode.delete(plugin))
  attempt(() => Global.hotSearch.delete(plugin))
  attempt(() => Global.levelboard.delete(plugin))
  attempt(() => Global.topButton.delete(plugin))
  attempt(() => Global.mainLists.delete(plugin))
  attempt(() => Global.removeOwnedRegistrations(plugin))
  attempt(() => pluginI18n.remove(plugin))
  attempt(() => removeSourcedEntries(Global.share, plugin))
  attempt(() => removeSourcedEntries(Global.shareToken, plugin))
  attempt(() => removeSourcedEntries(Global.userActions, plugin))
  attempt(() => removeSourcedEntries(Global.subscribes, plugin))

  for (const [contentType, value] of Object.entries(config.content ?? {})) {
    if (value.layout) attempt(() => uni.content.ContentPage.layouts.delete(contentType))
    if (value.itemCard) attempt(() => uni.item.Item.itemCards.delete(contentType))
    if (value.contentPage) attempt(() => uni.content.ContentPage.contentPages.delete(contentType))
    if (value.downloadProvider)
      attempt(() => uni.content.ContentPage.downloadProviders.delete(contentType))
    if (value.commentRow) attempt(() => uni.comment.Comment.commentRow.delete(contentType))
    if (value.itemTranslator) attempt(() => uni.item.Item.itemTranslator.delete(contentType))
  }
  for (const type of config.resource?.types ?? []) {
    attempt(() => uni.resource.Resource.fork.delete([plugin, type.type]))
    attempt(() => uni.resource.Resource.precedenceFork.delete([plugin, type.type]))
  }
  for (const name of Object.keys(config.resource?.process ?? {})) {
    attempt(() => uni.resource.Resource.processInstances.delete([plugin, name]))
  }
  if (config.user?.card) attempt(() => uni.user.User.userCards.delete(plugin))
  if (config.user?.edit) attempt(() => uni.user.User.userEditorBase.delete(plugin))
  for (const key of Object.keys(config.user?.authorIcon ?? {})) {
    attempt(() => uni.item.Item.authorIcon.delete([plugin, key]))
  }
  for (const pointer of config.config ?? []) attempt(() => useConfig().$unregisterConfig(pointer))

  attempt(() => defaultDependencyRegistry.delete(declareDepType(plugin)))
  attempt(() => usePluginStore().plugins.delete(plugin))
  attempt(() => releasePluginObjectUrls(plugin))
  if (typeof document !== 'undefined') {
    for (const node of document.querySelectorAll<HTMLStyleElement>('style[data-plugin]')) {
      if (node.dataset.plugin === plugin) attempt(() => node.remove())
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, `failed to completely clean plugin "${plugin}"`)
  }
}