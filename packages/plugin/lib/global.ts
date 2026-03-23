import { SourcedKeyMap } from '@delta-comic/model'
import { useGlobalVar } from '@delta-comic/utils'
import { shallowReactive, type Component, type Raw } from 'vue'

import type { Search, Share, Subscribe, User } from '@/plugin'

import type { GlobalInjectionsConfig } from './env'

class _Global {
  public share = shallowReactive(
    SourcedKeyMap.createReactive<[plugin: string, key: string], Share.InitiativeItem>()
  )
  public shareToken = shallowReactive(
    SourcedKeyMap.createReactive<[plugin: string, key: string], Share.ShareToken>()
  )
  public userActions = shallowReactive(
    SourcedKeyMap.createReactive<[plugin: string, key: string], User.UserAction>()
  )
  public subscribes = shallowReactive(
    SourcedKeyMap.createReactive<[plugin: string, key: string], Subscribe.Config>()
  )
  public globalNodes = shallowReactive(new Array<Raw<Component>>())

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

  public envExtends = shallowReactive(new Set<GlobalInjectionsConfig>())
}

export const Global = useGlobalVar(new _Global(), 'core/global')