import type { uni } from '@delta-comic/model'

export type Config = Record<
  string,
  {
    itemCard?: uni.item.ItemCardComponent
    commentRow?: uni.comment.CommentRow
    layout?: uni.content.LayoutComponent
    contentPage?: uni.content.ContentPageLike
    downloadProvider?: uni.download.ContentDownloadProvider
    itemTranslator?: uni.item.ItemTranslator
  }
>