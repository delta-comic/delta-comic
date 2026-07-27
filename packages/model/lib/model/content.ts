import { type Component } from 'vue'

import { SourcedKeyMap, type StreamQuery, type SourcedKeyType } from '../struct'

import * as comment from './comment'
import type { UniContentDownloadProvider } from './download'
import * as ep from './ep'
import * as item from './item'

export type UniContentPageLike = new (
  preload: item.UniItem | undefined,
  id: string,
  ep: string,
) => UniContentPage

export type UniContentType_ = SourcedKeyType<typeof UniContentPage.contentPages>
export type UniContentType = Exclude<UniContentType_, string>

export type UniContentViewComponent = Component<{ page: UniContentPage; union?: item.UniItem }>
export type UniContentLayoutComponent = Component<
  { page: UniContentPage },
  any,
  any,
  any,
  any,
  any,
  { view(args: { item?: item.UniItem }): any }
>

export abstract class UniContentPage {
  public static layouts = SourcedKeyMap.createReactive<UniContentType, UniContentLayoutComponent>()
  public static contentPages = SourcedKeyMap.createReactive<
    [plugin: string, name: string],
    UniContentPageLike
  >()
  public static downloadProviders = SourcedKeyMap.createReactive<
    UniContentType,
    UniContentDownloadProvider
  >()

  constructor(
    public preload: item.UniItem | undefined,
    public id: string,
    public ep: string,
  ) {}
  public abstract plugin: string
  public abstract contentType: UniContentType

  public abstract fetchShortId(signal?: AbortSignal): Promise<string>

  public abstract fetchDetail(signal?: AbortSignal): Promise<item.UniItem>

  public abstract fetchRecommends: StreamQuery<item.UniItem>

  public abstract fetchComments: StreamQuery<comment.UniComment>

  public abstract fetchEps: StreamQuery<ep.UniEp>

  public abstract ViewComponent: UniContentViewComponent
}