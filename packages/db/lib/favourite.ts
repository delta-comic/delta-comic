import {
  defineMutation,
  useMutation,
  useQueryCache,
  useQuery as useColadaQuery,
  type EntryKey,
} from '@pinia/colada'
import type { Kysely, Selectable, SelectQueryBuilder } from 'kysely'

import type { FavouriteCardTable } from './generated/favourite_card.table'
import type { FavouriteItemTable as GeneratedFavouriteItemTable } from './generated/favourite_item.table'
import * as ItemStoreDB from './itemStore'
import { CommonQueryKey, withTransition } from './utils'

import type { DB } from '.'

export type CardTable = FavouriteCardTable

export type Card = Selectable<CardTable>

export type ItemTable = GeneratedFavouriteItemTable

export type Item = Selectable<ItemTable>

export enum QueryKey {
  item = 'db:favouriteItem:',
  card = 'db:favouriteCard:',
}

export const useUpsertItem = defineMutation(() => {
  const queryCache = useQueryCache()
  const { key: iKey, upsert } = ItemStoreDB.useUpsert()
  const key = [CommonQueryKey.common, QueryKey.item, ...iKey]
  const { mutateAsync, ...mutation } = useMutation({
    mutation: async ({
      item,
      belongTos,
      trx,
    }: {
      item: ItemStoreDB.StorableItem
      belongTos: Item['belongTo'][]
      trx?: Kysely<DB>
    }) =>
      withTransition(async trx => {
        const itemKey = await upsert({ item, trx })
        await trx
          .replaceInto('favouriteItem')
          .values(belongTos.map(belongTo => ({ addTime: Date.now(), itemKey, belongTo })))
          .execute()
      }, trx),
    onSettled: () => {
      void queryCache.invalidateQueries({ key })
    },
    key,
  })
  return { ...mutation, upsert: mutateAsync, key }
})

export const useMoveItem = defineMutation(() => {
  const queryCache = useQueryCache()
  const key = [QueryKey.item]
  const { mutateAsync, ...mutation } = useMutation({
    mutation: async ({
      item,
      from,
      aims,
      trx,
    }: {
      item: ItemStoreDB.StorableItem
      from: Item['belongTo']
      aims: Item['belongTo'][]
      trx?: Kysely<DB>
    }) =>
      withTransition(async trx => {
        await trx
          .deleteFrom('favouriteItem')
          .where('itemKey', '=', item.id)
          .where('belongTo', '=', from)
          .execute()
        await trx
          .replaceInto('favouriteItem')
          .values(aims.map(to => ({ addTime: Date.now(), itemKey: item.id, belongTo: to })))
          .execute()
      }, trx),
    onSettled: () => {
      void queryCache.invalidateQueries({ key })
    },
    key,
  })
  return { ...mutation, move: mutateAsync, key }
})

export const useCreateCard = defineMutation(() => {
  const queryCache = useQueryCache()
  const key = [QueryKey.card, QueryKey.item]
  const { mutateAsync, ...mutation } = useMutation({
    mutation: async ({ card, trx }: { card: Card; trx?: Kysely<DB> }) =>
      withTransition(async trx => {
        await trx.replaceInto('favouriteCard').values(card).execute()
      }, trx),
    onSettled: () => {
      void queryCache.invalidateQueries({ key })
    },
    key,
  })
  return { ...mutation, createCard: mutateAsync, key }
})

export const useQueryItem = <T>(
  query: (db: SelectQueryBuilder<DB, 'favouriteItem', {}>) => Promise<T>,
  otherKeys: readonly EntryKey[] = [],
  initialData?: () => T,
) =>
  useColadaQuery({
    query: async () => {
      const { db } = await import('.')
      return await query(db.selectFrom('favouriteItem'))
    },
    key: () => [QueryKey.item, QueryKey.card, query, ...otherKeys],
    staleTime: 15000,
    initialData,
    initialDataUpdatedAt: 0,
  })

export const useQueryCard = <T>(
  query: (db: SelectQueryBuilder<DB, 'favouriteCard', {}>) => Promise<T>,
  otherKeys: readonly EntryKey[] = [],
  initialData?: () => T,
) =>
  useColadaQuery({
    query: async () => {
      const { db } = await import('.')
      return await query(db.selectFrom('favouriteCard'))
    },
    key: () => [QueryKey.card, query, ...otherKeys],
    staleTime: 15000,
    refetchOnMount: 'always',
    initialData,
    initialDataUpdatedAt: 0,
  })