import type { Selectable } from 'kysely'

import { ItemStoreDB } from './itemStore'

import { db } from '.'

export namespace RecentDB {
  export interface Table {
    timestamp: number
    itemKey: string
    isViewed: boolean
  }
  export type Item = Selectable<Table>

  export async function upsert(item: ItemStoreDB.StorableItem) {
    const itemKey = await ItemStoreDB.upsert(item)
    await db.value
      .replaceInto('recentView')
      .values({ isViewed: false, itemKey, timestamp: Date.now() })
      .execute()
  }
}