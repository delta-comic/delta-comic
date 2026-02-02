import type { Selectable } from 'kysely'

import { ItemStoreDB } from './itemStore'

import { db } from '.'

export namespace FavouriteDB {
  export interface CardTable {
    title: string
    private: boolean
    description: string
    createAt: number
  }

  export type Card = Selectable<CardTable>

  export interface ItemTable {
    itemKey: string
    belongTo: CardTable['createAt']
    addTime: number
  }

  export type Item = Selectable<ItemTable>

  export function upsertItem(item: ItemStoreDB.StorableItem, ...belongTos: Item['belongTo'][]) {
    return db.value
      .transaction()
      .setIsolationLevel('serializable')
      .execute(async trx => {
        const itemKey = await ItemStoreDB.upsert(item)
        for (const belongTo of belongTos)
          await trx
            .replaceInto('favouriteItem')
            .values({ addTime: Date.now(), itemKey, belongTo })
            .execute()
      })
  }

  export function moveItem(
    item: ItemStoreDB.StorableItem,
    from: Item['belongTo'],
    ...tos: Item['belongTo'][]
  ) {
    return db.value
      .transaction()
      .setIsolationLevel('serializable')
      .execute(async trx => {
        await trx
          .deleteFrom('favouriteItem')
          .where('itemKey', '=', item.id)
          .where('belongTo', '=', from)
          .execute()
        for (const to of tos)
          await trx
            .replaceInto('favouriteItem')
            .values({ addTime: Date.now(), itemKey: item.id, belongTo: to })
            .execute()
      })
  }
}