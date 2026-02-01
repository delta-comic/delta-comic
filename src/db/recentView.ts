import type { Selectable } from 'kysely'

import { db } from '.'
import { ItemStoreDB } from './itemStore'

export namespace RecentDB {
  export interface Table {
    timestamp: number
    itemKey: string
    isViewed: boolean
  }
  export type Item = Selectable<Table>

  export function upsert(item: ItemStoreDB.StorableItem) {
    return db.value
      .transaction()
      .setIsolationLevel('serializable')
      .execute(async db => {
        const itemKey = await ItemStoreDB.upsert(item)
        await db
          .replaceInto('recentView')
          .values({ isViewed: false, itemKey, timestamp: Date.now() })
          .execute()
      })
  }
}