import { useGlobalVar } from '@delta-comic/utils'
import { type Component } from 'vue'

import { SourcedKeyMap, type StreamQuery, type SourcedKeyType } from '../struct'

import * as comment from './comment'
import * as ep from './ep'
import * as item from './item'

export type ContentPageLike = new (
  preload: item.Item | undefined,
  id: string,
  ep: string
) => ContentPage

export type ContentType_ = SourcedKeyType<typeof ContentPage.contentPages>
export type ContentType = Exclude<ContentType_, string>

export type ViewComponent = Component<{ page: ContentPage; isFullScreen: boolean }>
export type LayoutComponent = Component<{ page: ContentPage }>

export abstract class ContentPage {
  public static layouts = useGlobalVar(
    SourcedKeyMap.createReactive<ContentType, LayoutComponent>(),
    'uni/contentPage/layouts'
  )
  public static contentPages = useGlobalVar(
    SourcedKeyMap.createReactive<[plugin: string, name: string], ContentPageLike>(),
    'uni/contentPage/contentPages'
  )

  constructor(
    public preload: item.Item | undefined,
    public id: string,
    public ep: string
  ) {}
  public abstract plugin: string
  public abstract contentType: ContentType

  public abstract fetchShortId: (signal?: AbortSignal) => Promise<string>

  public abstract fetchDetail: (signal?: AbortSignal) => Promise<item.Item>

  public abstract fetchRecommends: StreamQuery<[], item.Item>

  public abstract fetchComments: StreamQuery<[], comment.Comment>

  public abstract fetchEps: StreamQuery<[], ep.Ep>

  public abstract ViewComponent: ViewComponent
}