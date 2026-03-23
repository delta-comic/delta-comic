import { uni } from '@delta-comic/model'

import { useConfig } from '@/config'
import { Global } from '@/global'
import type { PluginConfig } from '@/plugin'

import { PluginBooter, type PluginBooterSetMeta } from '../utils'

class _ConfigSetter extends PluginBooter {
  public override name = '预设值'
  public override async call(cfg: PluginConfig, setMeta: PluginBooterSetMeta): Promise<any> {
    console.log('[PluginBooter->_ConfigSetter] new plugin defining...', cfg)
    setMeta('预设值设定中')
    const { name: plugin, content, resource, search, user, subscribe, share } = cfg
    if (content)
      for (const [
        ct,
        { commentRow, contentPage, itemCard, layout, itemTranslator }
      ] of Object.entries(content)) {
        if (layout) uni.content.ContentPage.layouts.set(ct, layout)
        if (itemCard) uni.item.Item.itemCards.set(ct, itemCard)
        if (contentPage) uni.content.ContentPage.contentPages.set(ct, contentPage)
        if (commentRow) uni.comment.Comment.commentRow.set(ct, commentRow)
        if (itemTranslator) uni.item.Item.itemTranslator.set(ct, itemTranslator)
      }

    if (resource) {
      if (resource.types)
        for (const type of resource.types) uni.resource.Resource.fork.set([plugin, type.type], type)
      if (resource.process)
        for (const [name, fn] of Object.entries(resource.process))
          uni.resource.Resource.processInstances.set([plugin, name], fn)
    }
    if (search) {
      if (search.categories) for (const c of search.categories) Global.addCategories(plugin, c)
      if (search.tabbar) for (const c of search.tabbar) Global.addTabbar(plugin, c)
      if (search.hotPage) {
        for (const mlc of search.hotPage.mainListCard ?? []) Global.addMainList(plugin, mlc)
        for (const lb of search.hotPage.levelBoard ?? []) Global.addLevelboard(plugin, lb)
        for (const tb of search.hotPage.topButton ?? []) Global.addTopButton(plugin, tb)
      }
      if (search.barcode) {
        for (const barcode of search.barcode ?? []) Global.addBarcode(plugin, barcode)
      }
    }
    if (user) {
      if (user.card) uni.user.User.userCards.set(plugin, user.card)
      if (user.edit) uni.user.User.userEditorBase.set(plugin, user.edit)
      if (user.userActions)
        for (const [type, value] of Object.entries(user.userActions))
          Global.userActions.set([plugin, type], value)
      if (user.authorIcon)
        for (const [key, value] of Object.entries(user.authorIcon))
          uni.item.Item.authorIcon.set([plugin, key], value)
    }
    if (subscribe) {
      for (const [key, value] of Object.entries(subscribe))
        Global.subscribes.set([plugin, key], value)
    }
    if (cfg.config) {
      for (const config of cfg.config) useConfig().$resignerConfig(config)
    }
    if (share) {
      for (const v of share.initiative ?? []) Global.share.set([plugin, v.key], v)
      for (const v of share.tokenListen ?? []) Global.shareToken.set([plugin, v.key], v)
    }
  }
}
export default new _ConfigSetter()