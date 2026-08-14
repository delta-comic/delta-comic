import { type Component } from 'vue'

import { field, MetaStruct, SourcedKeyMap, type Metadatable, type StreamQuery } from '../struct'

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

export abstract class UniComment extends MetaStruct<UniCommentRaw> implements UniCommentRaw {
  public static commentRow = SourcedKeyMap.createReactive<UniContentType, UniCommentRow>()

  public abstract sender: UniUser
  @field content!: { type: 'string' | 'html'; text: string }
  @field time!: number
  @field id!: string
  @field childrenCount!: number
  @field likeCount!: number
  @field isTop!: boolean
  @field isLiked!: boolean
  @field reported!: boolean
  public abstract like(signal?: AbortSignal): PromiseLike<boolean>
  public abstract report(signal?: AbortSignal): PromiseLike<any>
  public abstract sendComment(text: string, signal?: AbortSignal): PromiseLike<any>
  public abstract fetchChildren: StreamQuery<UniComment>
}