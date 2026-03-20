import { SourcedValue, Struct, uni } from '@delta-comic/model'
import type { JSONColumnType, Selectable } from 'kysely'

export interface Table {
  key: string
  item: JSONColumnType<uni.item.RawItem>
}
export type StorableItem = uni.item.Item | uni.item.RawItem
export type StoredItem = Selectable<Table>
export const key = new SourcedValue('*')

export async function upsert(item: StorableItem) {
  const { db } = await import('.')
  const k = key.toString([uni.content.ContentPage.contentPage.toString(item.contentType), item.id])
  await db.value
    .replaceInto('itemStore')
    .values({ item: Struct.toRaw(item), key: k })
    .execute()
  return k
}