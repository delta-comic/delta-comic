import type { uni } from '@delta-comic/model'

export type Config = Record<
  string,
  {
    itemCard?: uni.item.ItemCardComp
    commentRow?: uni.comment.CommentRow
    layout?: uni.content.ViewLayoutComp
    contentPage?: uni.content.ContentPageLike
    itemTranslator?: uni.item.ItemTranslator
  }
>