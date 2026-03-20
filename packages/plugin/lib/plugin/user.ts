import type { uni } from '@delta-comic/model'
import type { Component, MaybeRefOrGetter } from 'vue'

export interface Config {
  edit?: Component
  card?: uni.user.UserCardComp
  authorIcon?: Record<string, Component>
  /**
   * 1. download
   * 2. upload (收藏那些云端未收藏的漫画)
   */
  syncFavourite?: {
    download: () => PromiseLike<uni.item.Item[]>
    upload: (items: uni.item.RawItem[]) => PromiseLike<any>
  }

  /**
   * 你希望展示的(`userActions`)自己的板块的页面
   */
  userActionPages?: UserActionPage[]
  /**
   * 在用户界面，在历史记录那个板块的下方，你希望展示的自己的板块
   */
  userActions?: Record<string, UserAction>
}

export interface UserAction {
  call(author: uni.item.Author): any
  name: string
  icon?: Component
}

export interface UserActionPage {
  title?: string
  items: ActionPageItem[]

  clickPage?: Component
  clickText?: string
}
export type ActionPageItem =
  | {
      name: string
      key: string
      type: 'button'
      icon: Component

      page: Component
    }
  | {
      name: string
      key: string
      type: 'statistic'
      icon?: Component

      value: MaybeRefOrGetter<string | number>
    }