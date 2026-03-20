import { useGlobalVar } from '@delta-comic/utils'
import { computed, shallowRef, type Component } from 'vue'

import { PromiseContent, SourcedKeyMap, type RStream, type SourcedKeyType } from '../struct'
import * as comment from './comment'
import * as ep from './ep'
import * as item from './item'

export type PreloadValue = item.Item | undefined
export type ContentPageLike = new (preload: PreloadValue, id: string, ep: string) => ContentPage

export type ContentType_ = SourcedKeyType<typeof ContentPage.contentPage>
export type ContentType = Exclude<ContentType_, string>

export type ViewComp = Component<{ page: ContentPage; isFullScreen: boolean }>

export type ViewLayoutComp = Component<{ page: ContentPage }>

export abstract class ContentPage<T extends object = any> {
  public static viewLayout = useGlobalVar(
    SourcedKeyMap.create<ContentType, ViewLayoutComp>(),
    'uni/contentPage/viewLayout'
  )
  public static contentPage = useGlobalVar(
    SourcedKeyMap.create<[plugin: string, name: string], ContentPageLike>(),
    'uni/contentPage/contentPage'
  )

  constructor(
    preload: PreloadValue,
    public id: string,
    public ep: string
  ) {
    this.preload.value = preload
  }
  public abstract contentType: ContentType

  public pid = PromiseContent.withResolvers<string>()

  public preload = shallowRef<PreloadValue>(undefined)
  public detail = PromiseContent.withResolvers<item.Item>()
  public union = computed(() => this.detail.content.data.value ?? this.preload.value)

  public recommends = PromiseContent.withResolvers<item.Item[]>()

  public abstract comments: RStream<comment.Comment>

  public eps = PromiseContent.withResolvers<ep.Ep[]>()

  public abstract loadAll(signal?: AbortSignal): Promise<any>
  public abstract reloadAll(signal?: AbortSignal): Promise<any>

  public abstract plugin: string

  public abstract loadAllOffline(save: T): Promise<any>
  public abstract exportOffline(): Promise<T>

  public abstract ViewComp: ViewComp
}