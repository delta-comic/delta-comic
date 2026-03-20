import type { Selectable } from 'kysely'

import * as ItemStoreDB from './itemStore'

export interface Table {
  timestamp: number
  itemKey: string
  isViewed: boolean
}
export type Item = Selectable<Table>

export async function upsert(item: ItemStoreDB.StorableItem) {
  const { db } = await import('.')
  const itemKey = await ItemStoreDB.upsert(item)
  await db.value
    .replaceInto('recentView')
    .values({ isViewed: false, itemKey, timestamp: Date.now() })
    .execute()
}