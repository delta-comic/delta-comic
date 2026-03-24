import type { uni } from '@delta-comic/model'
import type { UseQueryReturn } from '@pinia/colada'
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
}

export interface SearchMethod {
  name: string
  sorts: { text: string; value: string }[]
  defaultSort: string
  search(
    input: string,
    sort: string,
    page: number,
    signal?: AbortSignal
  ): PromiseLike<{ items: uni.item.Item[]; nextPage?: number }>
  getAutoComplete(
    input: string,
    signal: AbortSignal
  ): PromiseLike<({ text: string; value: string } | Component)[]>
}

export interface HotLevelboard {
  name: string
  content: () => UseQueryReturn<uni.item.Item[]>
}
export interface HotMainList {
  name: string
  content: () => UseQueryReturn<uni.item.Item[]>
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
  contentType_: uni.content.ContentType_,
  id: string,
  ep: string,
  preload?: uni.item.Item
) => PromiseLike<any>

export interface Barcode {
  match: (searchText: string) => boolean
  /**
   * 选中后返回路由信息
   */
  getContent: (searchText: string, signal: AbortSignal) => PromiseLike<Parameters<RouteToContent>>
  name: string
}