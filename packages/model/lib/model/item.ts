import { type Component } from 'vue'

import { field, MetaStruct, SourcedKeyMap, transform, type Metadatable } from '../struct'

import { UniContentPage, type UniContentType, type UniContentType_ } from './content'
import { UniEp, type UniEpRaw } from './ep'
import * as image from './image'
import type { UniResourceRaw } from './resource'

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
    class?: any
    style?: any
  },
  any,
  any,
  any,
  any,
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

  public abstract like(): Promise<any>
  public abstract report(): Promise<any>
  public abstract sendComment(text: string): Promise<any>

  public static is(value: unknown): value is UniItem {
    return value instanceof this
  }
  @field cover!: UniResourceRaw | image.UniImageRaw
  public get $cover() {
    return image.UniImage.create(this.cover)
  }
  @field title!: string
  @field id!: string
  @field categories!: UniItemCategory[]
  @field author!: UniItemAuthor[]
  @field viewNumber?: number
  @field likeNumber?: number
  @field commentNumber?: number
  @field isLiked?: boolean
  @field description?: UniItemDescription
  @field updateTime?: number
  @transform((v: UniContentType_) => UniContentPage.contentPages.key.toJSON(v))
  contentType!: UniContentType
  @field length!: string
  @field epLength!: string
  @field thisEp!: UniEpRaw
  @field customIsSafe?: boolean
  public get $thisEp() {
    return new UniEp(this.thisEp)
  }
  @field commentSendable!: boolean
  @field customIsAI?: boolean
  public get $isAi() {
    const check = (str: string) => /(^|[(（[\s【])ai[】)）\]\s]?/gi.test(str)
    return (
      this.customIsAI ||
      check(this.title) ||
      this.author.some(author => check(`${author.label}\u1145${author.description}`))
    )
  }
}