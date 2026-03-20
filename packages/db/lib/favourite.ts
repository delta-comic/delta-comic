import type { Selectable } from 'kysely'

import * as ItemStoreDB from './itemStore'

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

export async function upsertItem(item: ItemStoreDB.StorableItem, ...belongTos: Item['belongTo'][]) {
  const { db } = await import('.')
  const itemKey = await ItemStoreDB.upsert(item)
  for (const belongTo of belongTos)
    await db.value
      .replaceInto('favouriteItem')
      .values({ addTime: Date.now(), itemKey, belongTo })
      .execute()
}

export async function moveItem(
  item: ItemStoreDB.StorableItem,
  from: Item['belongTo'],
  ...tos: Item['belongTo'][]
) {
  const { db } = await import('.')
  await db.value
    .deleteFrom('favouriteItem')
    .where('itemKey', '=', item.id)
    .where('belongTo', '=', from)
    .execute()
  for (const to of tos)
    await db.value
      .replaceInto('favouriteItem')
      .values({ addTime: Date.now(), itemKey: item.id, belongTo: to })
      .execute()
}