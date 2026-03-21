import { SourcedValue, type SourcedKeyType, type uni } from '@delta-comic/model'
import {
  defineMutation,
  useMutation,
  useQueryCache,
  useQuery as useColadaQuery
} from '@pinia/colada'
import type { JSONColumnType, Kysely, Selectable, SelectQueryBuilder } from 'kysely'

import { withTransition } from './utils'

import type { DB } from '.'

export const key = new SourcedValue<[plugin: string, label: string]>()
export type Key_ = SourcedKeyType<typeof key>
export type Key = Exclude<Key_, string>

export interface AuthorTable {
  author: JSONColumnType<uni.item.Author>
  itemKey: null
  type: 'author'
  /** @description primary key */
  key: string
  plugin: string
}
export type AuthorItem = Selectable<AuthorTable>

export interface EpTable {
  author: null
  itemKey: string // not f key
  type: 'ep'
  /** @description primary key */
  key: string
  plugin: string
}
export type EpItem = Selectable<EpTable>

export type Table = AuthorTable | EpTable
export type Item = AuthorItem | EpItem

export enum QueryKey {
  item = 'db:subscribe:'
}
const queryCache = useQueryCache()

export const useUpsert = defineMutation(() => {
  const key = [QueryKey.item]
  const { mutateAsync, ...mutation } = useMutation({
    mutation: async ({ items, trx }: { items: Item[]; trx?: Kysely<DB> }) =>
      withTransition(async trx => {
        await trx
          .replaceInto('subscribe')
          .values(items.map(item => ({ ...item, author: JSON.stringify(item.author) })))
          .execute()
      }, trx),
    onSettled: () => {
      void queryCache.invalidateQueries({ key })
    },
    key
  })
  return { ...mutation, upsert: mutateAsync, key }
})

export const useRemove = defineMutation(() => {
  const key = [QueryKey.item]
  const { mutateAsync, ...mutation } = useMutation({
    mutation: async ({ keys, trx }: { keys: Item['key'][]; trx?: Kysely<DB> }) =>
      withTransition(async trx => {
        await trx.deleteFrom('subscribe').where('subscribe.key', 'is', keys).execute()
      }, trx),
    onSettled: () => {
      void queryCache.invalidateQueries({ key })
    },
    key
  })
  return { ...mutation, remove: mutateAsync, key }
})

export const useQuery = <T>(
  query: (db: SelectQueryBuilder<DB, 'subscribe', {}>) => Promise<T>,
  otherKeys: any[] = [],
  initialData?: () => T
) =>
  useColadaQuery({
    query: async () => {
      const { db } = await import('.')
      return await query(db.selectFrom('subscribe'))
    },
    key: () => [QueryKey.item, query].concat(otherKeys),
    staleTime: 15000,
    initialData
  })