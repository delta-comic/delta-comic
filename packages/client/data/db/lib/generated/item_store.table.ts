import type { UniItemRaw } from '@delta-comic/client-core-model'
import type { Insertable, Selectable, Updateable, JSONColumnType } from 'kysely'

export interface ItemStoreTable {
  key: string
  item: JSONColumnType<UniItemRaw>
}

export type ItemStore = Selectable<ItemStoreTable>
export type NewItemStore = Insertable<ItemStoreTable>
export type ItemStoreUpdate = Updateable<ItemStoreTable>