export interface Metadatable {
  $$meta?: Metadata
  $$plugin: string
}
export type Metadata = Record<string | number, any>

export type PageKey = string | number
export class StreamQuery<TResult, TData extends object = {}> {
  constructor(
    public query: (
      data: TData,
      page: PageKey,
      signal?: AbortSignal
    ) => Promise<{ data: TResult[]; lastPage?: PageKey; nextPage?: PageKey }>,
    public initPage: PageKey
  ) {}
}