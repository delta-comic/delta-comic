import Database from '@tauri-apps/plugin-sql'
import { useStorage } from '@vueuse/core'
import { Utils } from 'delta-comic-core'
import { debounce, withTimeout } from 'es-toolkit'
import { CamelCasePlugin, Kysely, Migrator, type Migration, type SelectQueryBuilder } from 'kysely'
import { TauriSqliteDialect } from 'kysely-dialect-tauri'
import { SerializePlugin } from 'kysely-plugin-serialize'
import mitt from 'mitt'
import { defineStore } from 'pinia'
import { reactive, shallowRef, toRef, triggerRef, type MaybeRefOrGetter } from 'vue'

import type { PluginArchiveDB } from '@/plugin/db'

import type { FavouriteDB } from './favourite'
import type { HistoryDB } from './history'
import type { ItemStoreDB } from './itemStore'
import type { SubscribeDB } from './subscribe'

import { type RecentDB } from './recentView'
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

export const db = shallowRef(
  new Kysely<DB>({
    dialect: new TauriSqliteDialect({
      database: {
        close(db) {
          return database.close(db)
        },
        path: database.path,
        async select<T>(query: string, bindValues?: unknown[]) {
          const result = await withTimeout(() => database.select<T>(query, bindValues), 3000)
          if (MUTATION_KEYWORDS.test(query)) triggerUpdate()
          return result
        },
        async execute(query: string, bindValues?: unknown[]) {
          const result = await withTimeout(() => database.execute(query, bindValues), 3000)
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
window.$api.db = db

export namespace DBUtils {
  export async function countDb(sql: SelectQueryBuilder<DB, any, object>) {
    const v = await sql.select(db => db.fn.countAll<number>().as('count')).executeTakeFirstOrThrow()
    return v.count
  }
}

const useKvStore = defineStore(
  'staticKvs',
  () => {
    const store = reactive<Record<string, Record<string, any>>>({})

    return { store }
  },
  { tauri: { autoStart: id => id == 'staticKvs', deep: true } }
)

const saveKey = new Utils.data.SourcedValue()
export const useNativeStore = <T>(
  namespace: string,
  key: MaybeRefOrGetter<string>,
  defaultValue: MaybeRefOrGetter<T>
) => {
  const kvs = useKvStore()
  kvs.store[namespace] ??= {}
  return useStorage<T>(saveKey.toString([namespace, toRef(key).value]), defaultValue, {
    removeItem(key) {
      const [namespace, k] = saveKey.toJSON(key)
      delete kvs.store[namespace][k]
    },
    getItem(key) {
      const [namespace, k] = saveKey.toJSON(key)
      return kvs.store[namespace][k]
    },
    setItem(key, value) {
      const [namespace, k] = saveKey.toJSON(key)
      kvs.store[namespace][k] = value
    }
  })
}
window.$api.useNativeStore = useNativeStore