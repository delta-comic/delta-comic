import { SourcedValue, Struct, uni } from '@delta-comic/model'
import { defineMutation, useMutation, useQueryCache } from '@pinia/colada'
import type { JSONColumnType, Kysely, Selectable } from 'kysely'

import { CommonQueryKey, withTransition } from './utils'

import type { DB } from '.'

export interface Table {
  /** @description primary key */
  key: string
  item: JSONColumnType<uni.item.RawItem>
}
export type StorableItem = uni.item.Item | uni.item.RawItem
export type StoredItem = Selectable<Table>
export const itemKey = new SourcedValue('*')

export enum QueryKey {
  item = 'db:itemStore:'
}

export const useUpsert = defineMutation(() => {
  const queryCache = useQueryCache()
  const key = [CommonQueryKey.common, QueryKey.item]
  const { mutateAsync, ...mutation } = useMutation({
    mutation: async ({ item, trx }: { item: StorableItem; trx?: Kysely<DB> }) =>
      withTransition(async trx => {
        const k = itemKey.toString([
          uni.content.ContentPage.contentPages.key.toString(item.contentType),
          item.id
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
    key
  })
  return { ...mutation, upsert: mutateAsync, key }
})