import { SourcedValue, type SourcedKeyType, type uni } from '@delta-comic/model'
import type { JSONColumnType, Selectable } from 'kysely'

export const key = new SourcedValue<[plugin: string, label: string]>()
export type Key_ = SourcedKeyType<typeof key>
export type Key = Exclude<Key_, string>

export interface AuthorTable {
  author: JSONColumnType<uni.item.Author>
  itemKey: null
  type: 'author'
  key: string
  plugin: string
}
export type AuthorItem = Selectable<AuthorTable>

export interface EpTable {
  author: null
  itemKey: string // not f key
  type: 'ep'
  key: string
  plugin: string
}
export type EpItem = Selectable<EpTable>

export type Table = AuthorTable | EpTable
export type Item = AuthorItem | EpItem

export async function getAll() {
  const { db } = await import('.')
  return db.value.selectFrom('subscribe').selectAll().execute() as Promise<Item[]>
}
export async function upsert(item: Item) {
  const { db } = await import('.')
  return db.value
    .replaceInto('subscribe')
    .values({
      type: item.type,
      itemKey: item.itemKey,
      key: item.key,
      plugin: item.plugin,
      author: JSON.stringify(item.author)
    })
    .execute()
}