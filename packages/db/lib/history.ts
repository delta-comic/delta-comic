import { Struct, type uni } from '@delta-comic/model'
import type { JSONColumnType, Selectable } from 'kysely'

import * as ItemStoreDB from './itemStore'

export interface Table {
  timestamp: number
  itemKey: string
  ep: JSONColumnType<uni.ep.RawEp>
}

export type Item = Selectable<Table>
export async function upsert(item: ItemStoreDB.StorableItem) {
  const { db } = await import('.')
  const itemKey = await ItemStoreDB.upsert(item)
  await db.value
    .replaceInto('history')
    .values({ itemKey, timestamp: Date.now(), ep: Struct.toRaw(item) })
    .execute()
}