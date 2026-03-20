import dayjs from 'dayjs'
import { type Component } from 'vue'

import { SourcedKeyMap, Struct, type MetaData, type RStream } from '../struct'

import type { ContentType } from './content'
import type { Item } from './item'
import type { User } from './user'

export interface RawComment {
  sender: User
  content: { type: 'string' | 'html'; text: string }
  time: number
  id: string
  childrenCount: number
  likeCount: number
  isLiked: boolean
  reported: boolean
  $$plugin: string
  $$meta?: MetaData
  isTop: boolean
}

export type CommentRow = Component<{ comment: Comment; item: Item; parentComment?: Comment }>

export abstract class Comment extends Struct<RawComment> implements RawComment {
  public static commentRow = SourcedKeyMap.create<ContentType, CommentRow>()

  constructor(v: RawComment) {
    super(v)
    this.content = v.content
    this.time = v.time
    this.id = v.id
    this.childrenCount = v.childrenCount
    this.likeCount = v.likeCount
    this.isLiked = v.isLiked
    this.reported = v.reported
    this.$$plugin = v.$$plugin
    this.$$meta = v.$$meta
    this.isTop = v.isTop
  }
  public abstract sender: User
  public content: { type: 'string' | 'html'; text: string }
  public time: number
  public get $time() {
    return dayjs(this.time)
  }
  public id: string
  public childrenCount: number
  public likeCount: number
  public isTop: boolean
  public isLiked: boolean
  public reported: boolean
  public $$plugin: string
  public $$meta?: MetaData
  public abstract like(signal?: AbortSignal): PromiseLike<boolean>
  public abstract report(signal?: AbortSignal): PromiseLike<any>
  public abstract sendComment(text: string, signal?: AbortSignal): PromiseLike<any>
  public abstract children: RStream<Comment>
}