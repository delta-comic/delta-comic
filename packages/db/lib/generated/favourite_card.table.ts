import type { Insertable, Selectable, Updateable } from 'kysely'

export interface FavouriteCardTable {
  createAt: number
  title: string
  private: number
  description: string
}

export type FavouriteCard = Selectable<FavouriteCardTable>
export type NewFavouriteCard = Insertable<FavouriteCardTable>
export type FavouriteCardUpdate = Updateable<FavouriteCardTable>
