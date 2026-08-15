import { Struct } from '@delta-comic/model'
import {
  defineMutation,
  useMutation,
  useQueryCache,
  useQuery as useColadaQuery,
  type EntryKey,
} from '@pinia/colada'
import type { Kysely, SelectQueryBuilder } from 'kysely'

import type { HistoryTable } from './generated/history.table'
import * as ItemStoreDB from './itemStore'
import { CommonQueryKey, withTransition } from './utils'

import type { DB } from '.'

export type Table = HistoryTable

export type Item = Table

export enum QueryKey {
  item = 'db:history:',
}

export const useUpsert = defineMutation(() => {
  const queryCache = useQueryCache()
  const { key: iKey, upsert } = ItemStoreDB.useUpsert()
  const key = [CommonQueryKey.common, QueryKey.item, ...iKey]
  const { mutateAsync, ...mutation } = useMutation({
    mutation: async ({ item, trx }: { item: ItemStoreDB.StorableItem; trx?: Kysely<DB> }) =>
      withTransition(async trx => {
        const itemKey = await upsert({ item, trx })
        await trx
          .replaceInto('history')
          .values({ itemKey, timestamp: Date.now(), ep: Struct.toRaw(item.thisEp) })
          .execute()
      }, trx),
    onSettled: () => {
      void queryCache.invalidateQueries({ key })
    },
    key,
  })
  return { ...mutation, upsert: mutateAsync, key }
})

export const useRemove = defineMutation(() => {
  const queryCache = useQueryCache()
  const key = [CommonQueryKey.common, QueryKey.item]
  const { mutateAsync, ...mutation } = useMutation({
    mutation: ({ keys, trx }: { keys: Item['timestamp'][]; trx?: Kysely<DB> }) =>
      withTransition(async trx => {
        await trx.deleteFrom('history').where('history.timestamp', 'is', keys).execute()
      }, trx),
    onSettled: () => {
      void queryCache.invalidateQueries({ key })
    },
    key,
  })
  return { ...mutation, remove: mutateAsync, key }
})

export const useQuery = <T>(
  query: (db: SelectQueryBuilder<DB, 'history', {}>) => Promise<T>,
  otherKeys: readonly EntryKey[] = [],
  initialData?: () => T,
) =>
  useColadaQuery({
    query: async () => {
      const { db } = await import('.')
      return await query(db.selectFrom('history'))
    },
    key: () => [CommonQueryKey.common, QueryKey.item, query, ...otherKeys],
    staleTime: 15000,
    refetchOnMount: 'always',
    initialData,
    initialDataUpdatedAt: 0,
  })