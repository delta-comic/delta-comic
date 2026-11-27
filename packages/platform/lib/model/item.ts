import { type Component } from 'vue'
import type { StyleValue } from 'vue'
import type { ClassValue } from 'vue'

import { UniContentPage, type UniContentType, type UniContentType_ } from './content'
import { UniEp, type UniEpRaw } from './ep'
import * as image from './image'
import type { UniResourceRaw } from './resource'
import { MetaStruct, SourcedKeyMap, type Metadatable } from './struct'

export interface UniItemCategory extends Metadatable {
  name: string
  group: string
  search: { keyword: string; source: string; sort: string }
}

export interface UniItemAuthor extends Metadatable {
  label: string
  icon: UniResourceRaw | image.UniImageRaw | string
  description: string
  /**
   * 为空则不可订阅
   * 否则传入的为`defineConfig`中定义的`subscribe.type`
   */ subscribe?: string
  actions?: string[]
}

export interface UniItemRaw extends Metadatable {
  cover: UniResourceRaw | image.UniImageRaw
  title: string
  id: string
  /** @alias tags  */
  categories: UniItemCategory[]
  author: UniItemAuthor[]
  viewNumber?: number
  likeNumber?: number
  commentNumber?: number
  isLiked?: boolean
  updateTime?: number
  customIsAI?: boolean
  contentType: UniContentType_
  length: string
  epLength: string
  description?: UniItemDescription
  thisEp: UniEpRaw
  commentSendable: boolean
  customIsSafe?: boolean
}

export type UniItemCardComponent = Component<
  {
    item: UniItem
    freeHeight?: boolean
    disabled?: boolean
    type?: 'default' | 'big' | 'small'
    style?: StyleValue
    class?: ClassValue
  },
  {},
  {},
  {},
  {},
  { click: [] },
  { default(): void; smallTopInfo(): void; cover(): void }
>

export type UniItemTranslator = (raw: UniItemRaw) => UniItem

export type UniItemDescription =
  | string
  | { type: 'html'; content: string }
  | { type: 'text'; content: string }

export abstract class UniItem extends MetaStruct<UniItemRaw> implements UniItemRaw {
  public static itemTranslator = SourcedKeyMap.createReactive<
    [plugin: string, name: string],
    UniItemTranslator
  >()
  public static create(raw: UniItemRaw) {
    const translator = this.itemTranslator.get(raw.contentType)
    if (!translator)
      throw new Error(
        `can not found itemTranslator contentType:"${UniContentPage.contentPages.key.toString(raw.contentType)}"`,
      )
    return translator(raw)
  }
  public static authorIcon = SourcedKeyMap.createReactive<
    [plugin: string, name: string],
    Component
  >()

  public static itemCards = SourcedKeyMap.createReactive<UniContentType, UniItemCardComponent>()

  public abstract like(): Promise<unknown>
  public abstract report(): Promise<unknown>
  public abstract sendComment(text: string): Promise<unknown>

  public static is(value: unknown): value is UniItem {
    return value instanceof this
  }
  cover = this.$$raw.cover
  public get $cover() {
    return image.UniImage.create(this.cover)
  }
  title = this.$$raw.title
  id = this.$$raw.id
  categories = this.$$raw.categories
  author = this.$$raw.author
  viewNumber = this.$$raw.viewNumber
  likeNumber = this.$$raw.likeNumber
  commentNumber = this.$$raw.commentNumber
  isLiked = this.$$raw.isLiked
  description = this.$$raw.description
  updateTime = this.$$raw.updateTime
  contentType = UniContentPage.contentPages.key.toJSON(this.$$raw.contentType)
  length = this.$$raw.length
  epLength = this.$$raw.epLength
  thisEp = this.$$raw.thisEp
  customIsSafe = this.$$raw.customIsSafe
  public get $thisEp() {
    return new UniEp(this.thisEp)
  }
  commentSendable = this.$$raw.commentSendable
  customIsAI = this.$$raw.customIsAI
  public get $isAi() {
    const check = (str: string) => /(^|[(（[\s【])ai[】)）\]\s]?/gi.test(str)
    return (
      this.customIsAI ||
      check(this.title) ||
      this.author.some(author => check(`${author.label}\u1145${author.description}`))
    )
  }
}