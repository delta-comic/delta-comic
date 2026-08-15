import type { Insertable, Selectable, Updateable, JSONColumnType } from 'kysely'
import type { UniItemRaw } from '@delta-comic/model'

export interface ItemStoreTable {
  key: string
  item: JSONColumnType<UniItemRaw>
}

export type ItemStore = Selectable<ItemStoreTable>
export type NewItemStore = Insertable<ItemStoreTable>
export type ItemStoreUpdate = Updateable<ItemStoreTable>
