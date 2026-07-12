import {
  defineMutation,
  useMutation,
  useQueryCache,
  useQuery as useColadaQuery,
} from '@pinia/colada'
import type { JSONColumnType, Kysely, Selectable, SelectQueryBuilder } from 'kysely'

import { CommonQueryKey, withTransition } from './utils'

import type { DB } from '.'

export interface Meta {
  name: { display: string; id: string }
  version: { plugin: string; supportCore: string }
  author: string
  description: string
  require: { id: string; download?: string | undefined }[]
  entry?: { jsPath: string; cssPath?: string }
  kind?: 'normal' | 'preboot'
  integrity?: { algorithm: 'blake3' | 'sha256'; digest: string }
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
  item = 'db:plugin:',
}

export const removeByNames = async (keys: Archive['pluginName'][], trx: Kysely<DB>) => {
  if (keys.length === 0) return
  await trx.deleteFrom('plugin').where('plugin.pluginName', 'in', keys).execute()
}

export const useUpsert = defineMutation(() => {
  const queryCache = useQueryCache()
  const key = [CommonQueryKey.common, QueryKey.item]
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
    key,
  })
  return { ...mutation, upsert: mutateAsync, key }
})

export const useRemove = defineMutation(() => {
  const queryCache = useQueryCache()
  const key = [CommonQueryKey.common, QueryKey.item]
  const { mutateAsync, ...mutation } = useMutation({
    mutation: async ({ keys, trx }: { keys: Archive['pluginName'][]; trx?: Kysely<DB> }) =>
      withTransition(async trx => {
        await removeByNames(keys, trx)
      }, trx),
    onSettled: () => {
      void queryCache.invalidateQueries({ key })
    },
    key,
  })
  return { ...mutation, remove: mutateAsync, key }
})

export const useToggleEnable = defineMutation(() => {
  const queryCache = useQueryCache()
  const key = [CommonQueryKey.common, QueryKey.item]
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
    key,
  })
  return { ...mutation, toggle: mutateAsync, key }
})

export const useSetKind = defineMutation(() => {
  const queryCache = useQueryCache()
  const key = [CommonQueryKey.common, QueryKey.item]
  const { mutateAsync, ...mutation } = useMutation({
    mutation: async ({
      pluginName,
      kind,
    }: {
      pluginName: string
      kind: NonNullable<Meta['kind']>
    }) =>
      withTransition(async trx => {
        const plugin = await trx
          .selectFrom('plugin')
          .select('meta')
          .where('pluginName', '=', pluginName)
          .executeTakeFirstOrThrow()
        await trx
          .updateTable('plugin')
          .set({ meta: JSON.stringify({ ...plugin.meta, kind }) })
          .where('pluginName', '=', pluginName)
          .execute()
      }),
    onSettled: () => {
      void queryCache.invalidateQueries({ key })
    },
    key,
  })
  return { ...mutation, setKind: mutateAsync, key }
})

export const useQuery = <T>(
  query: (db: SelectQueryBuilder<DB, 'plugin', {}>) => Promise<T>,
  otherKeys: any[] = [],
  initialData?: () => T,
) =>
  useColadaQuery({
    query: async () => {
      const { db } = await import('.')
      return await query(db.selectFrom('plugin'))
    },
    key: () => [CommonQueryKey.common, QueryKey.item, query].concat(otherKeys),
    staleTime: 15000,
    refetchOnMount: 'always',
    initialData,
    initialDataUpdatedAt: 0,
  })