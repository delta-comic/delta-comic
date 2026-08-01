import type { FormConfigure, FormSingleResult } from '@delta-comic/model'
import type { UniItem, UniItemAuthor, UniItemRaw, UniUserCardComponent } from '@delta-comic/model'
import type { Component, MaybeRefOrGetter } from 'vue'

export interface UserModel {
  auth: Auth
  edit?: Component
  card?: UniUserCardComponent
  /**
   * 你希望展示的(`userActions`)自己的板块的页面
   */
  userActionPages?: UserActionPage[]
  /**
   * 在用户界面，在历史记录那个板块的下方，你希望展示的自己的板块
   */
  userActions?: UserAction[]

  favourites: Favourites
}

// auth
export interface Auth {
  selections: Selection[]
  /**
   * @returns `string` -> id; `false` -> by user; `true` -> no auth
   */
  default: () => Promise<string | boolean>
}

export interface Selection {
  name: string
  id: string
  call: (by: Method) => Promise<void>
}

export type Method = {
  form<T extends FormConfigure>(
    form: T,
  ): Promise<{
    [x in keyof T]: FormSingleResult<T[x]>
  }>
  /**
   * @param injectCode 你可以在js调用`callback(...)`来完成鉴权，传值为你给的回调
   */
  website<T>(url: string, injectCode: InjectCode): Promise<CallbackResult<T>>
}

export interface InjectCode {
  js: string
  css: string
}

export interface CallbackResult<T> {
  callbackValue: T
  cookie: string
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
  href: string
  title: string
}

// user

export interface UserAction {
  call(author: UniItemAuthor): any
  name: string
  id: string
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

export interface Favourites {
  download: (signal: AbortSignal) => Promise<UniItem[]>
  upload: (items: UniItemRaw[], signal: AbortSignal) => Promise<void>
}