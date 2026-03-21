import {
  defineMutation,
  useMutation,
  useQueryCache,
  useQuery as useColadaQuery
} from '@pinia/colada'
import type { Kysely, Selectable, SelectQueryBuilder } from 'kysely'

import * as ItemStoreDB from './itemStore'
import { withTransition } from './utils'

import type { DB } from '.'

export interface Table {
  /** @description primary key */
  timestamp: number
  itemKey: string
  isViewed: boolean
}
export type Item = Selectable<Table>

export enum QueryKey {
  item = 'db:recentView:'
}
const queryCache = useQueryCache()

export const useUpsert = defineMutation(() => {
  const { key: iKey, upsert } = ItemStoreDB.useUpsert()
  const key = [QueryKey.item, ...iKey]
  const { mutateAsync, ...mutation } = useMutation({
    mutation: async ({ item, trx }: { item: ItemStoreDB.StorableItem; trx?: Kysely<DB> }) =>
      withTransition(async trx => {
        const itemKey = await upsert({ item, trx })
        await trx
          .replaceInto('recentView')
          .values({ isViewed: false, itemKey, timestamp: Date.now() })
          .execute()
      }, trx),
    onSettled: () => {
      queryCache.invalidateQueries({ key })
    },
    key
  })
  return { ...mutation, upsert: mutateAsync, key }
})

export const useRemove = defineMutation(() => {
  const key = [QueryKey.item]
  const { mutateAsync, ...mutation } = useMutation({
    mutation: async ({ items, trx }: { items: Item['timestamp'][]; trx?: Kysely<DB> }) =>
      withTransition(async trx => {
        await trx.deleteFrom('recentView').where('recentView.timestamp', 'is', items).execute()
      }, trx),
    onSettled: () => {
      queryCache.invalidateQueries({ key })
    },
    key
  })
  return { ...mutation, remove: mutateAsync, key }
})

export const useQuery = <T>(
  query: (db: SelectQueryBuilder<DB, 'recentView', {}>) => Promise<T>,
  otherKeys: any[] = [],
  initialData?: () => T
) =>
  useColadaQuery({
    query: async () => {
      const { db } = await import('.')
      return await query(db.selectFrom('recentView'))
    },
    key: () => [QueryKey.item, query].concat(otherKeys),
    staleTime: 15000,
    initialData
  })