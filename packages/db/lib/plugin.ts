import {
  defineMutation,
  useMutation,
  useQueryCache,
  useQuery as useColadaQuery
} from '@pinia/colada'
import type { JSONColumnType, Kysely, Selectable, SelectQueryBuilder } from 'kysely'

import { withTransition } from './utils'

import type { DB } from '.'

export interface Meta {
  name: { display: string; id: string }
  version: { plugin: string; supportCore: string }
  author: string
  description: string
  require: { id: string; download?: string | undefined }[]
  entry?: { jsPath: string; cssPath?: string }
  beforeBoot?: { path: string; slot: string }[]
}

export interface Table {
  installerName: string
  loaderName: string
  /** @description primary key */
  pluginName: string
  meta: JSONColumnType<Meta>
  enable: boolean
  installInput: string
  displayName: string
}

/** @description Not Blue */
export type Archive = Selectable<Table>

export enum QueryKey {
  item = 'db:plugin:'
}

const queryCache = useQueryCache()

export const useUpsert = defineMutation(() => {
  const key = [QueryKey.item]
  const { mutateAsync, ...mutation } = useMutation({
    mutation: async ({ archives, trx }: { archives: Archive[]; trx?: Kysely<DB> }) =>
      withTransition(async trx => {
        await trx
          .replaceInto('plugin')
          .values(archives.map(a => ({ ...a, meta: JSON.stringify(a.meta) })))
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
    mutation: async ({ keys, trx }: { keys: Archive['pluginName'][]; trx?: Kysely<DB> }) =>
      withTransition(async trx => {
        await trx.deleteFrom('plugin').where('plugin.pluginName', 'is', keys).execute()
      }, trx),
    onSettled: () => {
      void queryCache.invalidateQueries({ key })
    },
    key
  })
  return { ...mutation, remove: mutateAsync, key }
})

export const useToggleEnable = defineMutation(() => {
  const key = [QueryKey.item]
  const { mutateAsync, ...mutation } = useMutation({
    mutation: async ({ keys, trx }: { keys: Archive['pluginName'][]; trx?: Kysely<DB> }) =>
      withTransition(async trx => {
        for (const key of keys) {
          const isEnable = await trx
            .selectFrom('plugin')
            .where('pluginName', '=', key)
            .select('enable')
            .executeTakeFirstOrThrow()
          return trx
            .updateTable('plugin')
            .where('pluginName', '=', key)
            .set({ enable: !isEnable.enable })
            .execute()
        }
      }, trx),
    onSettled: () => {
      void queryCache.invalidateQueries({ key })
    },
    key
  })
  return { ...mutation, toggle: mutateAsync, key }
})

export const useQuery = <T>(
  query: (db: SelectQueryBuilder<DB, 'plugin', {}>) => Promise<T>,
  otherKeys: any[] = [],
  initialData?: () => T
) =>
  useColadaQuery({
    query: async () => {
      const { db } = await import('.')
      return await query(db.selectFrom('plugin'))
    },
    key: () => [QueryKey.item, query].concat(otherKeys),
    staleTime: 15000,
    initialData
  })