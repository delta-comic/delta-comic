export * from './layout'
export * from './type'

import type { StreamQuery } from '@delta-comic/model'
import type { UseInfiniteQueryReturn, UseQueryReturn } from '@pinia/colada'
import { noop } from 'es-toolkit'

export type RawSource<T> =
  | { type: 'query'; value: UseQueryReturn<T[]>; next?: () => any }
  | { type: 'infinite'; value: UseInfiniteQueryReturn<T[]> }
  | { type: 'stream'; value: UseInfiniteQueryReturn<Awaited<ReturnType<StreamQuery<T>['query']>>> }
  | { type: 'array'; value: Array<T>; refetch?: () => any; refresh?: () => any; next?: () => any }
export interface UnionSource<T> {
  data: T[]
  isDone: boolean
  isLoading: boolean
  error: Error | null
  refetch(): Promise<any>
  refresh(): Promise<any>
  next(): Promise<any>
}

export const toUnionSource = <T>(source: RawSource<T>): UnionSource<T> => {
  switch (source.type) {
    case 'query':
      return {
        data: source.value.data.value ?? [],
        isDone: true,
        isLoading: source.value.isLoading.value,
        error: source.value.error.value,
        refetch() {
          return source.value.refetch(false)
        },
        refresh() {
          return source.value.refresh(false)
        },
        next: () => Promise.try(source.next ?? noop),
      }
    case 'stream':
      return {
        data: source.value.data.value?.pages.flatMap(p => p.data) ?? [],
        isDone: !source.value.hasNextPage.value,
        isLoading: source.value.isLoading.value,
        error: source.value.error.value,
        refetch() {
          return source.value.refetch(false)
        },
        refresh() {
          return source.value.refresh(false)
        },
        next() {
          return source.value.loadNextPage({ cancelRefetch: true })
        },
      }
    case 'infinite':
      return {
        data: source.value.data.value?.pages.flat(1) ?? [],
        isDone: !source.value.hasNextPage.value,
        isLoading: source.value.isLoading.value,
        error: source.value.error.value,
        refetch() {
          return source.value.refetch(false)
        },
        refresh() {
          return source.value.refresh(false)
        },
        next() {
          return source.value.loadNextPage({ cancelRefetch: true })
        },
      }
    case 'array':
    default:
      return {
        data: source.value,
        isDone: true,
        isLoading: false,
        error: null,
        refetch: () => Promise.try(source.refetch ?? noop),
        refresh: () => Promise.try(source.refresh ?? noop),
        next: () => Promise.try(source.next ?? noop),
      }
  }
}