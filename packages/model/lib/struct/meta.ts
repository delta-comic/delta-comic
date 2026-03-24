export interface Metadatable {
  $$meta?: Metadata
  $$plugin: string
}
export type Metadata = Record<string | number, any>

export type PageKey = string | number
export interface StreamQuery<TParameters extends any[], TItem> {
  (
    ...args: [...TParameters, page: PageKey, signal?: AbortSignal]
  ): Promise<TItem[] & { nextPage?: PageKey }>
  initialPageParam: PageKey
}