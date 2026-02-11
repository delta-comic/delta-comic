import Database from '@tauri-apps/plugin-sql'
import { useStorageAsync } from '@vueuse/core'
import { Utils } from 'delta-comic-core'
import { debounce, isString, isUndefined } from 'es-toolkit'
import { CamelCasePlugin, Kysely, Migrator, type Migration, type SelectQueryBuilder } from 'kysely'
import { TauriSqliteDialect } from 'kysely-dialect-tauri'
import { SerializePlugin } from 'kysely-plugin-serialize'
import mitt from 'mitt'
import { shallowRef, toRef, triggerRef, type MaybeRefOrGetter } from 'vue'

import type { PluginArchiveDB } from '@/plugin/db'

import type { FavouriteDB } from './favourite'
import type { HistoryDB } from './history'
import type { ItemStoreDB } from './itemStore'
import { type RecentDB } from './recentView'
import type { SubscribeDB } from './subscribe'
const migrations = import.meta.glob<Migration>('./migrations/*.ts', {
  eager: true,
  import: 'default'
})

export interface DB {
  itemStore: ItemStoreDB.Table
  favouriteCard: FavouriteDB.CardTable
  favouriteItem: FavouriteDB.ItemTable
  history: HistoryDB.Table
  recentView: RecentDB.Table
  subscribe: SubscribeDB.Table
  plugin: PluginArchiveDB.Table
}
const database = await Database.load(`sqlite:app.db`)
window.$api.database = database
// await database.execute('PRAGMA foreign_keys = ON;')
const emitter = mitt<{ onChange: void; noUse: bigint }>()

const MUTATION_KEYWORDS = /\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER)\b/i
const triggerUpdate = debounce(() => {
  console.debug('[db sync] db changed')
  emitter.emit('onChange')
  triggerRef(db)
}, 300)

export const db = await (async () => {
  const db = shallowRef(
    new Kysely<DB>({
      dialect: new TauriSqliteDialect({
        database: {
          close(db) {
            return database.close(db)
          },
          path: database.path,
          async select<T>(query: string, bindValues?: unknown[]) {
            console.debug('sql!', query, bindValues)
            const result = await database.select<T>(query, bindValues)
            if (MUTATION_KEYWORDS.test(query)) triggerUpdate()
            return result
          },
          async execute(query: string, bindValues?: unknown[]) {
            console.debug('sql!', query, bindValues)
            const result = await database.execute(query, bindValues)
            if (MUTATION_KEYWORDS.test(query)) triggerUpdate()
            return result
          }
        }
      }),
      plugins: [new CamelCasePlugin(), new SerializePlugin()]
    })
  )
  const migrator = new Migrator({
    db: db.value,
    provider: {
      async getMigrations() {
        return migrations
      }
    }
  })
  await migrator.migrateToLatest()
  return db
})()
window.$api.db = db

export namespace DBUtils {
  export async function countDb(sql: SelectQueryBuilder<DB, any, object>) {
    const v = await sql.select(db => db.fn.countAll<number>().as('count')).executeTakeFirstOrThrow()
    return v.count
  }
}

import { Store } from '@tauri-apps/plugin-store'

const saveKey = new Utils.data.SourcedValue<[namespace: string, key: string]>()
export const useNativeStore = <T extends object>(
  namespace: string,
  key: MaybeRefOrGetter<string>,
  defaultValue: MaybeRefOrGetter<T>
) => {
  const _store = Store.load(namespace, { defaults: {} })
  const useStore = async () => {
    const store = await _store
    await store.reload()
    return Object.assign(store, {
      async [Symbol.asyncDispose]() {
        await store.save()
      }
    })
  }
  return useStorageAsync<T>(saveKey.toString([namespace, toRef(key).value]), defaultValue, {
    async removeItem(key) {
      const [, k] = saveKey.toJSON(key)
      const store = await useStore()
      await store.delete(k)
      await store[Symbol.asyncDispose]()
    },
    async getItem(key) {
      const [, k] = saveKey.toJSON(key)
      const store = await useStore()
      return store
        .get<T>(k)
        .then(v => (isString(v) ? v : isUndefined(v) ? null : JSON.stringify(v)))
    },
    async setItem(key, value) {
      const [, k] = saveKey.toJSON(key)
      const store = await useStore()
      await store.set(k, value)
      await store[Symbol.asyncDispose]()
    }
  })
}
window.$api.useNativeStore = useNativeStore