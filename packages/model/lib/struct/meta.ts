import { field } from './decorators'
import { Struct } from './struct'

export interface Metadatable {
  $$meta?: Metadata
  $$plugin: string
}
export type Metadata = Record<string | number, any>

/**
 * 带来源元数据（`Metadatable`）的结构化基类，`$$plugin`/`$$meta`由装饰器从原始数据复制
 */
export abstract class MetaStruct<TRaw extends Metadatable & object> extends Struct<TRaw> {
  @field $$plugin!: string
  @field $$meta?: Metadata
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