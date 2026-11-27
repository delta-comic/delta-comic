import { type Component } from 'vue'

import type { UniContentType } from './content'
import type { UniItem } from './item'
import { MetaStruct, SourcedKeyMap, type Metadatable, type StreamQuery } from './struct'
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
  content = this.$$raw.content
  time = this.$$raw.time
  id = this.$$raw.id
  childrenCount = this.$$raw.childrenCount
  likeCount = this.$$raw.likeCount
  isTop = this.$$raw.isTop
  isLiked = this.$$raw.isLiked
  reported = this.$$raw.reported
  public abstract like(signal?: AbortSignal): Promise<boolean>
  public abstract report(signal?: AbortSignal): Promise<unknown>
  public abstract sendComment(text: string, signal?: AbortSignal): Promise<unknown>
  public abstract fetchChildren: StreamQuery<UniComment>
}