import type {
  UniContentPage,
  UniImage,
  StreamQuery,
  UniItem,
  UniItemAuthor,
} from '@delta-comic/model'
import type { Component } from 'vue'

export interface SocialModel {
  share?: Share
  subscribe?: Subscribe
}

// share
export interface Share {
  initiative?: InitiativeItem[]
  tokenListen?: ShareToken[]
}

export interface ShareToken {
  key: string
  name: string
  isMatched(chipboard: string): boolean
  show(chipboard: string): Promise<SharePopupConfig>
}

export interface SharePopupConfig {
  title: string
  detail: string
  onPositive(): void
  onNegative(): void
}

export interface InitiativeItem {
  key: string
  name: string
  icon: Component | UniImage
  bgColor?: string
  call(page: UniContentPage): Promise<{ token?: string } | void>
  filter(page: UniContentPage): boolean
}

// subscribe
export interface Subscribe {
  getUpdateList: SubscribeListProvider
  fetchAuthorContent: StreamQuery<UniItem, { author: UniItemAuthor }>
}

export type SubscribeListProvider = (
  olds: { author: UniItemAuthor; list: UniItem[] }[],
  signal: AbortSignal,
) => Promise<{ isUpdated: boolean; whichUpdated: UniItemAuthor[] }>