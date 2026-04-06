import type { StreamQuery, uni } from '@delta-comic/model'

export interface Config {
  getUpdateList(
    olds: { author: uni.item.Author; list: uni.item.Item[] }[],
    signal?: AbortSignal
  ): PromiseLike<{ isUpdated: boolean; whichUpdated: uni.item.Author[] }>
  onAdd?(author: uni.item.Author): any
  onRemove?(author: uni.item.Author): any
  fetchAuthorContent: StreamQuery<uni.item.Item, { author: uni.item.Author }>
}