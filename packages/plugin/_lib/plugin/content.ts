import type {
  UniCommentRow,
  UniContentDownloadProvider,
  UniContentLayoutComponent,
  UniContentPageLike,
  UniItemCardComponent,
  UniItemTranslator,
} from '@delta-comic/model'

export type Config = Record<
  string,
  {
    itemCard?: UniItemCardComponent
    commentRow?: UniCommentRow
    layout?: UniContentLayoutComponent
    contentPage?: UniContentPageLike
    downloadProvider?: UniContentDownloadProvider
    itemTranslator?: UniItemTranslator
  }
>