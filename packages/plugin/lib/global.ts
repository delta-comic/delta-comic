import { SourcedKeyMap } from '@delta-comic/model'
import type { UniContentType_, UniItem } from '@delta-comic/model'
import { shallowReactive } from 'vue'

import type { Social, User, Content } from '@/export'

declare module '@delta-comic/utils' {
  export interface SharedFunctions {
    routeToContent(
      contentType_: UniContentType_,
      id: string,
      ep: string,
      preload?: UniItem,
    ): Promise<any>
    routeToSearch(
      input: string,
      source?: [plugin: string, name: string],
      sort?: string,
    ): Promise<any>
    pushShareToken(token: string): Promise<any>
  }
}

class _Global {
  public share = shallowReactive(
    SourcedKeyMap.createReactive<[plugin: string, key: string], Social.InitiativeItem>(),
  )
  public shareToken = shallowReactive(
    SourcedKeyMap.createReactive<[plugin: string, key: string], Social.ShareToken>(),
  )
  public userActions = shallowReactive(
    SourcedKeyMap.createReactive<[plugin: string, key: string], User.UserAction>(),
  )
  public subscribes = shallowReactive(
    SourcedKeyMap.createReactive<[plugin: string, key: string], Social.Subscribe>(),
  )

  public tabbar = shallowReactive(new Map<string, Content.Tabbar[]>())
  public addTabbar(plugin: string, ...tabbar: Content.Tabbar[]) {
    const old = this.tabbar.get(plugin) ?? []
    this.tabbar.set(plugin, old.concat(tabbar))
  }

  public categories = shallowReactive(new Map<string, Content.Category[]>())
  public addCategories(plugin: string, ...categories: Content.Category[]) {
    const old = this.categories.get(plugin) ?? []
    this.categories.set(plugin, old.concat(categories))
  }

  public barcode = shallowReactive(new Map<string, Content.Barcode[]>())
  public addBarcode(plugin: string, ...barcode: Content.Barcode[]) {
    const old = this.barcode.get(plugin) ?? []
    this.barcode.set(plugin, old.concat(barcode))
  }

  public hotSearch = shallowReactive(new Map<string, Content.HotSearchProvider[]>())
  public addHotSearch(plugin: string, ...providers: Content.HotSearchProvider[]) {
    const old = this.hotSearch.get(plugin) ?? []
    this.hotSearch.set(plugin, old.concat(providers))
  }

  public levelboard = shallowReactive(new Map<string, Content.HotLevelboard[]>())
  public addLevelboard(plugin: string, ...levelboard: Content.HotLevelboard[]) {
    const old = this.levelboard.get(plugin) ?? []
    this.levelboard.set(plugin, old.concat(levelboard))
  }

  public topButton = shallowReactive(new Map<string, Content.HotTopButton[]>())
  public addTopButton(plugin: string, ...topButton: Content.HotTopButton[]) {
    const old = this.topButton.get(plugin) ?? []
    this.topButton.set(plugin, old.concat(topButton))
  }

  public hotCategory = shallowReactive(new Map<string, Content.HotCategory[]>())
  public addHotCategory(plugin: string, ...hotCategory: Content.HotCategory[]) {
    const old = this.hotCategory.get(plugin) ?? []
    this.hotCategory.set(plugin, old.concat(hotCategory))
  }
}

export const Global = new _Global()