export interface Metadatable {
  $$meta?: Metadata
  $$plugin: string
}
export type Metadata = Record<string | number, any>

export type PageKey = string | number
export interface RangedResult<T> {
  items: T[]
  nextPage?: PageKey
}