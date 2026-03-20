import { useGlobalVar } from '@delta-comic/utils'
import dayjs from 'dayjs'
import { type Component } from 'vue'

import { SourcedKeyMap, Struct, type MetaData } from '../struct'
import { ContentPage, type ContentType, type ContentType_ } from './content'
import { Ep, type RawEp } from './ep'
import * as image from './image'
import type { RawResource } from './resource'

export interface Category {
  name: string
  group: string
  search: { keyword: string; source: string; sort: string }
}

export interface Author {
  label: string
  icon: RawResource | image.RawImage | string
  description: string
  /**
   * 为空则不可订阅
   * 否则传入的为`defineConfig`中定义的`subscribe.type`
   */ subscribe?: string
  actions?: string[]
  $$meta?: MetaData
  $$plugin: string
}

export interface RawItem {
  cover: RawResource | image.RawImage
  title: string
  id: string
  /** @alias tags  */
  categories: Category[]
  author: Author[]
  viewNumber?: number
  likeNumber?: number
  commentNumber?: number
  isLiked?: boolean
  updateTime?: number
  customIsAI?: boolean
  contentType: ContentType_
  length: string
  epLength: string
  $$plugin: string
  $$meta: MetaData
  description?: Description
  thisEp: RawEp
  commentSendable: boolean
  customIsSafe?: boolean
}

export type ItemCardComp = Component<
  {
    item: Item
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

export type ItemTranslator = (raw: RawItem) => Item

export type Description =
  | string
  | { type: 'html'; content: string }
  | { type: 'text'; content: string }

export abstract class Item extends Struct<RawItem> implements RawItem {
  public static itemTranslator = SourcedKeyMap.create<
    [plugin: string, name: string],
    ItemTranslator
  >()
  public static create(raw: RawItem) {
    const translator = this.itemTranslator.get(raw.contentType)
    if (!translator)
      throw new Error(
        `can not found itemTranslator contentType:"${ContentPage.contentPage.toString(raw.contentType)}"`
      )
    return translator(raw)
  }
  public static authorIcon = SourcedKeyMap.create<[plugin: string, name: string], Component>()

  public static itemCard = useGlobalVar(
    SourcedKeyMap.create<ContentType, ItemCardComp>(),
    'uni/item/itemCard'
  )

  public abstract like(signal?: AbortSignal): PromiseLike<boolean>
  public abstract report(signal?: AbortSignal): PromiseLike<any>
  public abstract sendComment(text: string, signal?: AbortSignal): PromiseLike<any>

  public static is(value: unknown): value is Item {
    return value instanceof this
  }
  public cover: RawResource | image.RawImage
  public get $cover() {
    return image.Image.create(this.cover)
  }
  public title: string
  public id: string
  public categories: Category[]
  public author: Author[]
  public viewNumber?: number
  public likeNumber?: number
  public commentNumber?: number
  public isLiked?: boolean
  public description?: Description
  public updateTime?: number
  public get $updateTime() {
    return dayjs(this.updateTime)
  }
  public contentType: ContentType
  public length: string
  public epLength: string
  public $$plugin: string
  public $$meta
  public thisEp: RawEp
  public customIsSafe?: boolean
  public get $thisEp() {
    return new Ep(this.thisEp)
  }
  constructor(v: RawItem) {
    super(v)
    this.$$plugin = v.$$plugin
    this.$$meta = v.$$meta

    this.thisEp = v.thisEp
    this.updateTime = v.updateTime
    this.cover = v.cover
    this.title = v.title
    this.id = v.id
    this.categories = v.categories
    this.author = v.author
    this.viewNumber = v.viewNumber
    this.likeNumber = v.likeNumber
    this.commentNumber = v.commentNumber
    this.isLiked = v.isLiked
    this.customIsAI = v.customIsAI
    this.contentType = ContentPage.contentPage.toJSON(v.contentType)
    this.length = v.length
    this.epLength = v.epLength
    this.description = v.description
    this.commentSendable = v.commentSendable
    this.customIsSafe = v.customIsSafe
  }
  public commentSendable: boolean
  public customIsAI?: boolean
  public get $isAi() {
    const check = (str: string) => /(^|[\(（\[\s【])ai[】\)）\]\s]?/gi.test(str)
    return (
      this.customIsAI ||
      check(this.title) ||
      this.author.some(author => check(`${author.label}\u1145${author.description}`))
    )
  }
}