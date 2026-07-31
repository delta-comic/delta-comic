import type {
  UniCommentRow,
  UniContentDownloadProvider,
  UniContentLayoutComponent,
  UniContentPageLike,
  UniItemCardComponent,
  UniItemTranslator,
} from '@delta-comic/model'

export interface ContentModel {
  models: Model[]
}

export interface Model {
  name: string
  ItemCard?: UniItemCardComponent
  CommentRow?: UniCommentRow
  Layout?: UniContentLayoutComponent
  ContentPage?: UniContentPageLike
  DownloadProvider?: UniContentDownloadProvider
  ItemTranslator?: UniItemTranslator
}