import { type Component } from 'vue'

import { SourcedKeyMap, Struct, type Metadata, type Metadatable, type StreamQuery } from '../struct'

import type { UniContentType } from './content'
import type { UniItem } from './item'
import type { UniUser } from './user'

export interface UniCommentRaw extends Metadatable {
  sender: UniUser
  content: { type: 'string' | 'html'; text: string }
  time: number
  id: string
  childrenCount: number
  likeCount: number
  isLiked: boolean
  reported: boolean
  isTop: boolean
}

export type UniCommentRow = Component<{
  comment: UniComment
  item: UniItem
  parentComment?: UniComment
}>

export abstract class UniComment extends Struct<UniCommentRaw> implements UniCommentRaw {
  public static commentRow = SourcedKeyMap.createReactive<UniContentType, UniCommentRow>()

  constructor(v: UniCommentRaw) {
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
  public abstract sender: UniUser
  public content: { type: 'string' | 'html'; text: string }
  public time: number
  public id: string
  public childrenCount: number
  public likeCount: number
  public isTop: boolean
  public isLiked: boolean
  public reported: boolean
  public $$plugin: string
  public $$meta?: Metadata
  public abstract like(signal?: AbortSignal): PromiseLike<boolean>
  public abstract report(signal?: AbortSignal): PromiseLike<any>
  public abstract sendComment(text: string, signal?: AbortSignal): PromiseLike<any>
  public abstract fetchChildren: StreamQuery<UniComment>
}