import { Struct } from './struct'

export interface Metadatable {
  $$meta?: Metadata
  $$plugin: string
}
export type Metadata = Record<string | number, unknown>

/**
 * 带来源元数据（`Metadatable`）的结构化基类，`$$plugin`/`$$meta`从原始数据初始化
 */
export abstract class MetaStruct<TRaw extends Metadatable & object> extends Struct<TRaw> {
  $$plugin = this.$$raw.$$plugin
  $$meta = this.$$raw.$$meta
}

export type PageKey = string | number
export class StreamQuery<TResult, TData extends object = {}> {
  constructor(
    public query: (
      data: TData,
      page: PageKey,
      signal?: AbortSignal,
    ) => Promise<{ data: TResult[]; lastPage?: PageKey; nextPage?: PageKey }>,
    public initPage: PageKey,
  ) {}
}