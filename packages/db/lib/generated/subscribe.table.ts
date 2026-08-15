import type { Insertable, Selectable, Updateable, JSONColumnType } from 'kysely'
import type { UniItemAuthor } from '@delta-comic/model'

export interface SubscribeTable {
  itemKey: string | null
  author: JSONColumnType<UniItemAuthor> | null
  type: string
  key: string
  plugin: string
}

export type Subscribe = Selectable<SubscribeTable>
export type NewSubscribe = Insertable<SubscribeTable>
export type SubscribeUpdate = Updateable<SubscribeTable>
