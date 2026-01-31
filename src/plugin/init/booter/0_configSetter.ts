import { Store, uni, type PluginConfig } from "delta-comic-core"
import { PluginBooter, type PluginBooterSetMeta } from "../utils"


class _ConfigSetter extends PluginBooter {
  public override name = '预设值'
  public override async call(cfg: PluginConfig, setMeta: PluginBooterSetMeta): Promise<any> {
    console.log('[PluginBooter->_ConfigSetter] new plugin defining...', cfg)
    setMeta('预设值设定中')
    const {
      name: plugin,
      content,
      resource,
      search,
      user,
      subscribe,
      share,
    } = cfg
    if (content)
      for (const [ct, { commentRow, contentPage, itemCard, layout, itemTranslator }] of Object.entries(content)) {
        if (layout)
          uni.content.ContentPage.viewLayout.set(ct, layout)
        if (itemCard)
          uni.item.Item.itemCard.set(ct, itemCard)
        if (contentPage)
          uni.content.ContentPage.contentPage.set(ct, contentPage)
        if (commentRow)
          uni.comment.Comment.commentRow.set(ct, commentRow)
        if (itemTranslator)
          uni.item.Item.itemTranslator.set(ct, itemTranslator)
      }

    if (resource) {
      if (resource.types)
        for (const type of resource.types)
          uni.resource.Resource.fork.set([plugin, type.type], type)
      if (resource.process)
        for (const [name, fn] of Object.entries(resource.process))
          uni.resource.Resource.processInstances.set([plugin, name], fn)
    }
    if (search) {
      if (search.categories)
        for (const c of search.categories)
          uni.content.ContentPage.addCategories(plugin, c)
      if (search.tabbar)
        for (const c of search.tabbar)
          uni.content.ContentPage.addTabbar(plugin, c)
      if (search.hotPage) {
        for (const mlc of search.hotPage.mainListCard ?? [])
          uni.content.ContentPage.addMainList(plugin, mlc)
        for (const lb of search.hotPage.levelBoard ?? [])
          uni.content.ContentPage.addLevelboard(plugin, lb)
        for (const tb of search.hotPage.topButton ?? [])
          uni.content.ContentPage.addTopButton(plugin, tb)
      }
      if (search.barcode) {
        for (const barcode of search.barcode ?? [])
          uni.content.ContentPage.addBarcode(plugin, barcode)
      }
    }
    if (user) {
      if (user.edit)
        uni.user.User.userEditorBase.set(plugin, user.edit)
      if (user.authorActions)
        for (const [type, value] of Object.entries(user.authorActions))
          uni.user.User.authorActions.set([plugin, type], value)
      if (user.authorIcon)
        for (const [key, value] of Object.entries(user.authorIcon))
          uni.item.Item.authorIcon.set([plugin, key], value)
    }
    if (subscribe) {
      for (const [key, value] of Object.entries(subscribe))
        uni.user.User.subscribes.set([plugin, key], value)
    }
    if (cfg.config) {
      for (const config of cfg.config)
        Store.useConfig().$resignerConfig(config)
    }
    if (share) {
      for (const v of share.initiative ?? [])
        uni.content.ContentPage.share.set([plugin, v.key], v)
      for (const v of share.tokenListen ?? [])
        uni.content.ContentPage.shareToken.set([plugin, v.key], v)
    }
  }
}
export default new _ConfigSetter