import { uni, Utils } from 'delta-comic-core'
import type {
  JSONColumnType,
  Selectable,
} from 'kysely'
import { db } from '.'


export namespace ItemStoreDB {
  export interface Table {
    key: string
    item: JSONColumnType<uni.item.RawItem>
  }
  export type StorableItem = uni.item.Item | uni.item.RawItem
  export type StoredItem = Selectable<Table>

  export async function upsert(item: StorableItem) {
    await db.value.replaceInto('itemStore')
      .values({
        item: Utils.data.Struct.toRaw(item),
        key: item.id
      })
      .execute()
    return item.id
  }
}