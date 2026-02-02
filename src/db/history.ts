import { uni, Utils } from 'delta-comic-core'
import type { JSONColumnType, Selectable } from 'kysely'

import { ItemStoreDB } from './itemStore'

import { db } from '.'

export namespace HistoryDB {
  export interface Table {
    timestamp: number
    itemKey: string
    ep: JSONColumnType<uni.ep.RawEp>
  }

  export type Item = Selectable<Table>
  export async function upsert(item: ItemStoreDB.StorableItem) {
    return db.value
      .transaction()
      .setIsolationLevel('serializable')
      .execute(async txr => {
        const itemKey = await ItemStoreDB.upsert(item)
        await txr
          .replaceInto('history')
          .values({ itemKey, timestamp: Date.now(), ep: Utils.data.Struct.toRaw(item) })
          .execute()
      })
  }
}