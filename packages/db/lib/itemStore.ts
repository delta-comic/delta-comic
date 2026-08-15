import {
  SourcedValue,
  Struct,
  UniContentPage,
  type UniItem,
  type UniItemRaw,
} from '@delta-comic/model'
import { defineMutation, useMutation, useQueryCache } from '@pinia/colada'
import type { Kysely, Selectable } from 'kysely'

import type { ItemStoreTable } from './generated/item_store.table'
import { CommonQueryKey, withTransition } from './utils'

import type { DB } from '.'

export type Table = ItemStoreTable
export type StorableItem = UniItem | UniItemRaw
export type StoredItem = Selectable<Table>
export const itemKey = new SourcedValue('*')

export enum QueryKey {
  item = 'db:itemStore:',
}

export const useUpsert = defineMutation(() => {
  const queryCache = useQueryCache()
  const key = [CommonQueryKey.common, QueryKey.item]
  const { mutateAsync, ...mutation } = useMutation({
    mutation: async ({ item, trx }: { item: StorableItem; trx?: Kysely<DB> }) =>
      withTransition(async trx => {
        const k = itemKey.toString([
          UniContentPage.contentPages.key.toString(item.contentType),
          item.id,
        ])
        await trx
          .replaceInto('itemStore')
          .values({ item: Struct.toRaw(item), key: k })
          .execute()
        return k
      }, trx),
    onSettled: () => {
      void queryCache.invalidateQueries({ key })
    },
    key,
  })
  return { ...mutation, upsert: mutateAsync, key }
})