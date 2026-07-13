import { SourcedKeyMap, uni } from '@delta-comic/model'
import { environmentRegistry } from '@delta-comic/ui'
import { SharedFunction } from '@delta-comic/utils'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { shallowReactive, type Component, type Raw } from 'vue'

import { pluginI18n, pluginMessageKey } from '@/i18n'
import type { Search, Share, Subscribe, User } from '@/plugin'

import { usePluginStore } from './driver'
import { runtimeExtensions } from './driver/extensions'
import { OfflineShareRound, TagOutlined } from './driver/icon'

class _Global {
  public share = shallowReactive(
    SourcedKeyMap.createReactive<[plugin: string, key: string], Share.InitiativeItem>(),
  )
  public shareToken = shallowReactive(
    SourcedKeyMap.createReactive<[plugin: string, key: string], Share.ShareToken>(),
  )
  public userActions = shallowReactive(
    SourcedKeyMap.createReactive<[plugin: string, key: string], User.UserAction>(),
  )
  public subscribes = shallowReactive(
    SourcedKeyMap.createReactive<[plugin: string, key: string], Subscribe.Config>(),
  )
  public globalNodes = shallowReactive(new Array<Raw<Component>>())

  private readonly globalNodeOwners = new Map<Raw<Component>, string>()
  private readonly registrationOwners: string[] = []

  /**
   * Associates global registrations made by a plugin with that plugin. The runtime
   * deliberately loads plugins serially while this ambient scope is active.
   */
  public async withRegistrationOwner<T>(plugin: string, action: () => Promise<T>): Promise<T> {
    this.registrationOwners.push(plugin)
    try {
      return await runtimeExtensions.withOwner(plugin, () =>
        environmentRegistry.withOwner(plugin, action),
      )
    } finally {
      this.registrationOwners.pop()
    }
  }

  private get registrationOwner() {
    return this.registrationOwners.at(-1)
  }

  public addGlobalNode(component: Raw<Component>, plugin = this.registrationOwner) {
    this.globalNodes.push(component)
    if (plugin) this.globalNodeOwners.set(component, plugin)
    return component
  }

  /** Removes only registrations owned by the requested plugin. */
  public removeOwnedRegistrations(plugin: string) {
    for (let index = this.globalNodes.length - 1; index >= 0; index--) {
      const component = this.globalNodes[index]
      if (this.globalNodeOwners.get(component) !== plugin) continue
      this.globalNodes.splice(index, 1)
      this.globalNodeOwners.delete(component)
    }
    environmentRegistry.removeOwner(plugin)
    runtimeExtensions.removeOwner(plugin)
  }

  public tabbar = shallowReactive(new Map<string, Search.Tabbar[]>())
  public addTabbar(plugin: string, ...tabbar: Search.Tabbar[]) {
    const old = this.tabbar.get(plugin) ?? []
    this.tabbar.set(plugin, old.concat(tabbar))
  }

  public categories = shallowReactive(new Map<string, Search.Category[]>())
  public addCategories(plugin: string, ...categories: Search.Category[]) {
    const old = this.categories.get(plugin) ?? []
    this.categories.set(plugin, old.concat(categories))
  }

  public barcode = shallowReactive(new Map<string, Search.Barcode[]>())
  public addBarcode(plugin: string, ...barcode: Search.Barcode[]) {
    const old = this.barcode.get(plugin) ?? []
    this.barcode.set(plugin, old.concat(barcode))
  }

  public levelboard = shallowReactive(new Map<string, Search.HotLevelboard[]>())
  public addLevelboard(plugin: string, ...levelboard: Search.HotLevelboard[]) {
    const old = this.levelboard.get(plugin) ?? []
    this.levelboard.set(plugin, old.concat(levelboard))
  }

  public topButton = shallowReactive(new Map<string, Search.HotTopButton[]>())
  public addTopButton(plugin: string, ...topButton: Search.HotTopButton[]) {
    const old = this.topButton.get(plugin) ?? []
    this.topButton.set(plugin, old.concat(topButton))
  }

  public mainLists = shallowReactive(new Map<string, Search.HotMainList[]>())
  public addMainList(plugin: string, ...mainLists: Search.HotMainList[]) {
    const old = this.mainLists.get(plugin) ?? []
    this.mainLists.set(plugin, old.concat(mainLists))
  }
}

export const Global = new _Global()

// share

interface CorePluginTokenShareMeta {
  item: { name: string; contentType: string; ep: string }
  plugin: string
  id: string
}

Global.share.set(['core', 'token'], {
  filter: page => !!page.preload,
  icon: TagOutlined,
  key: 'token',
  name: pluginMessageKey('plugin.share.copyToken'),
  async call(page) {
    const item = page.preload?.toJSON()
    if (!item) throw new Error('Not found preload in content. Maybe not fetch detail?')

    const compressed = compressToEncodedURIComponent(
      JSON.stringify(<CorePluginTokenShareMeta>{
        item: {
          contentType: uni.content.ContentPage.contentPages.key.toString(item.contentType),
          ep: item.thisEp.id,
          name: item.title,
        },
        plugin: page.plugin,
        id: page.id,
      }),
    )
    return { token: `[${item.title}](复制这条口令，打开Delta Comic)${compressed}` }
  },
})

Global.share.set(['core', 'native'], {
  filter: page => !!page.preload,
  icon: OfflineShareRound,
  key: 'native',
  name: pluginMessageKey('plugin.share.native'),
  async call(page) {
    const item = page.preload?.toJSON()
    if (!item) throw new Error('Not found preload in content. Maybe not fetch detail?')

    const compressed = compressToEncodedURIComponent(
      JSON.stringify(<CorePluginTokenShareMeta>{
        item: {
          contentType: uni.content.ContentPage.contentPages.key.toString(item.contentType),
          ep: item.thisEp.id,
          name: item.title,
        },
        plugin: page.plugin,
        id: page.id,
      }),
    )
    const token = `[${item.title}](复制这条口令，打开Delta Comic)${compressed}`
    await navigator.share({ title: pluginI18n.translate('plugin.share.nativeTitle'), text: token })

    return { token }
  },
})

Global.shareToken.set(['core', 'token'], {
  key: 'token',
  name: pluginMessageKey('plugin.share.defaultToken'),
  patten(chipboard) {
    return /^\[.+\]\(复制这条口令，打开Delta Comic\).+/.test(chipboard)
  },
  show(chipboard) {
    const pluginStore = usePluginStore()
    const meta: CorePluginTokenShareMeta = JSON.parse(
      decompressFromEncodedURIComponent(
        chipboard.replace(/^\[.+\]/, '').replaceAll('(复制这条口令，打开Delta Comic)', ''),
      ),
    )
    return {
      title: pluginI18n.translate('plugin.share.tokenTitle'),
      detail: pluginI18n.translate('plugin.share.tokenDetail', {
        item: meta.item.name,
        plugin: pluginStore.$getI18nName(meta.plugin),
      }),
      onNegative() {},
      onPositive() {
        return SharedFunction.call(
          'routeToContent',
          uni.content.ContentPage.contentPages.key.toJSON(meta.item.contentType),
          meta.id,
          meta.item.ep,
        )
      },
    }
  },
})