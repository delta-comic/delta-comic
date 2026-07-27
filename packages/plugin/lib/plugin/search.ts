import type { StreamQuery, UniContentType_, UniItem } from '@delta-comic/model'
import type { Component } from 'vue'

export interface Config {
  /**
   * @description
   * key: id
   */
  methods?: Record<string, SearchMethod>

  tabbar?: Tabbar[]

  categories?: Category[]

  hotPage?: {
    levelBoard?: HotLevelboard[]
    topButton?: HotTopButton[]
    mainListCard?: HotMainList[]
  }

  barcode?: Barcode[]

  /** Search landing-page sections supplied by this plugin. */
  hotSearch?: HotSearchProvider[]

  fetchRandomItems?: ItemProvider
}

export type ItemProvider = (signal: AbortSignal) => UniItem[] | PromiseLike<UniItem[]>

export interface SearchMethod {
  name: string
  sorts: { text: string; value: string }[]
  defaultSort: string
  fetchSearchResult: StreamQuery<UniItem, { input: string; sort: string }>
  getAutoComplete(
    input: string,
    signal: AbortSignal,
  ): PromiseLike<({ text: string; value: string } | Component)[]>
}

export interface HotSearchTarget {
  /** Search method key declared by the same plugin. */
  method: string
  /** Falls back to the search method's default sort when omitted. */
  sort?: string
}

export interface HotSearchItem {
  text: string
  /** Search input used after selection. Defaults to `text`. */
  value?: string
  badge?: { text: string; tone?: 'accent' | 'warning' }
  /** Overrides the provider target for this item. */
  target?: HotSearchTarget
}

export interface HotSearchProvider {
  title: string
  target: HotSearchTarget
  fetchItems(signal: AbortSignal): PromiseLike<HotSearchItem[]> | HotSearchItem[]
}

export interface HotLevelboard {
  name: string
  content: ItemProvider
}
export interface HotMainList {
  name: string
  content: ItemProvider
  onClick?(): any
}
export interface HotTopButton {
  name: string
  icon: Component
  bgColor: string
  onClick?(): any
}

export interface Category {
  title: string
  namespace: string
  search: { methodId: string; input: string; sort: string }
}

export interface Tabbar {
  title: string
  id: string
  comp: Component<{ isActive: boolean; tabbar: Tabbar }>
}

export type RouteToContent = (
  contentType_: UniContentType_,
  id: string,
  ep: string,
  preload?: UniItem,
) => PromiseLike<any>

export interface Barcode {
  match: (searchText: string) => boolean
  /**
   * 选中后返回路由信息
   */
  getContent: (searchText: string, signal: AbortSignal) => PromiseLike<Parameters<RouteToContent>>
  name: string
}