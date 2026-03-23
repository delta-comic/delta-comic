import { useGlobalVar } from '@delta-comic/utils'
import { type UseInfiniteQueryReturn, type UseQueryReturn } from '@pinia/colada'
import { computed, shallowRef, type Component } from 'vue'

import { SourcedKeyMap, type SourcedKeyType } from '../struct'

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
    preload: item.Item | undefined,
    public id: string,
    public ep: string
  ) {
    this.preload.value = preload
  }
  public abstract plugin: string
  public abstract contentType: ContentType

  public shortId = shallowRef<UseQueryReturn<string>>()

  public preload = shallowRef<item.Item | undefined>()
  public detail = shallowRef<UseQueryReturn<item.Item>>()
  public union = computed(() => this.detail.value?.data.value ?? this.preload.value)

  public recommends = shallowRef<UseQueryReturn<item.Item[]>>()

  public comments = shallowRef<UseInfiniteQueryReturn<comment.Comment>>()

  public eps = Promise.withResolvers<ep.Ep[]>()

  public abstract loadAll(signal?: AbortSignal): Promise<this>

  public abstract ViewComponent: ViewComponent
}