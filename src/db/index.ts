import Database from '@tauri-apps/plugin-sql'
import { useStorage } from '@vueuse/core'
import { Utils } from 'delta-comic-core'
import { debounce } from 'es-toolkit'
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

import { Store } from 'tauri-store'

const store = new Store('counter', {} as Record<string, any>)

await store.start()

const saveKey = new Utils.data.SourcedValue()
export const useNativeStore = <T>(
  namespace: string,
  key: MaybeRefOrGetter<string>,
  defaultValue: MaybeRefOrGetter<T>
) => {
  store.update(namespace, s => s ?? {})
  return useStorage<T>(saveKey.toString([namespace, toRef(key).value]), defaultValue, {
    removeItem(key) {
      const [namespace, k] = saveKey.toJSON(key)
      store.update(namespace, s => {
        delete s[k]
        return s
      })
    },
    getItem(key) {
      const [namespace, k] = saveKey.toJSON(key)
      return store.get(namespace)[k]
    },
    setItem(key, value) {
      const [namespace, k] = saveKey.toJSON(key)
      store.update(namespace, s => {
        s[k] = value
        return s
      })
    }
  })
}
window.$api.useNativeStore = useNativeStore