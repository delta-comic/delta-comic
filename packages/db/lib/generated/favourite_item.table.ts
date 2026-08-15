import type { Insertable, Selectable, Updateable } from 'kysely'

export interface FavouriteItemTable {
  addTime: number
  belongTo: number
  itemKey: string
}

export type FavouriteItem = Selectable<FavouriteItemTable>
export type NewFavouriteItem = Insertable<FavouriteItemTable>
export type FavouriteItemUpdate = Updateable<FavouriteItemTable>