import type { uni } from '@delta-comic/model'

export type Config = Record<
  string,
  {
    itemCard?: uni.item.ItemCardComponent
    commentRow?: uni.comment.CommentRow
    layout?: uni.content.LayoutComponent
    contentPage?: uni.content.ContentPageLike
    itemTranslator?: uni.item.ItemTranslator
  }
>