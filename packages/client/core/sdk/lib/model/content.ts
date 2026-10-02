import type {
  StreamQuery,
  UniCommentRow,
  UniContentDownloadProvider,
  UniContentLayoutComponent,
  UniContentPageLike,
  UniItem,
  UniItemCardComponent,
  UniItemTranslator,
} from '@delta-comic/model'
import type { Component } from 'vue'

export interface ContentModel {
  models?: Model[]
  search?: Search
  promotes?: Promotes
}

// model
export interface Model {
  name: string
  ItemCard?: UniItemCardComponent
  CommentRow?: UniCommentRow
  Layout?: UniContentLayoutComponent
  ContentPage?: UniContentPageLike
  DownloadProvider?: UniContentDownloadProvider
  ItemTranslator?: UniItemTranslator
}

// search
export interface Search {
  methods: SearchMethod[]
  barcode?: Barcode[]
  getHotSearch: HotSearchProvider
}

export type HotSearchProvider = (signal: AbortSignal) => Promise<SearchAim[]>

export interface SearchMethod {
  name: string
  id: string
  sorts: { options: { label: string; id: string }[]; default: string }

  fetchSearchResult: StreamQuery<UniItem, { aim: SearchAim }>
  getAutoComplete: AutoCompleteProvider
}

export type AutoCompleteProvider = (
  input: string,
  signal: AbortSignal,
) => Promise<SearchAim[] | Component>

export interface SearchAim {
  input: string
  search: { method: string; sort?: string }
}

export interface Barcode {
  name: string
  id: string
  getTipText: (aim: SearchAim) => string
  isMatch: (aim: SearchAim) => boolean
}

// promotes
export interface Promotes {
  tabbar?: Tabbar[]
  categories?: Category[]
  hotPageContent?: HotPageContent

  fetchRandomItems?: ItemProvider
}

export type ItemProvider = (signal: AbortSignal) => Promise<UniItem[]>

export interface Category {
  title: string
  namespace: string
  search: SearchAim
}

export interface Tabbar {
  title: string
  id: string
  comp: Component<{ isActive: boolean; tabbar: Tabbar }>
}

// promotes - hotPageContent

export interface HotPageContent {
  levelboard?: HotLevelboard[]
  topButton?: HotTopButton[]
  categories?: HotCategory[]
}

export interface HotLevelboard {
  name: string
  id: string
  content: ItemProvider
}
export interface HotCategory {
  name: string
  content: ItemProvider
}
export interface HotTopButton {
  name: string
  icon: Component
  bgColor: string
}