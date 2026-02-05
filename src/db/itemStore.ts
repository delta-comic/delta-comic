import { uni, Utils } from 'delta-comic-core'
import type { JSONColumnType, Selectable } from 'kysely'

import { db } from '.'

export namespace ItemStoreDB {
  export interface Table {
    key: string
    item: JSONColumnType<uni.item.RawItem>
  }
  export type StorableItem = uni.item.Item | uni.item.RawItem
  export type StoredItem = Selectable<Table>
  export const key = new Utils.data.SourcedValue('*')

  export async function upsert(item: StorableItem) {
    const k = key.toString([
      uni.content.ContentPage.contentPage.toString(item.contentType),
      item.id
    ])
    await db.value
      .replaceInto('itemStore')
      .values({ item: Utils.data.Struct.toRaw(item), key: k })
      .execute()
    return k
  }
}