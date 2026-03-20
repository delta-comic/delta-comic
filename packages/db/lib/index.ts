import { useGlobalVar } from '@delta-comic/utils'
import Database from '@tauri-apps/plugin-sql'
import { debounce } from 'es-toolkit'
import { CamelCasePlugin, Kysely, Migrator, type Migration, type SelectQueryBuilder } from 'kysely'
import { TauriSqliteDialect } from 'kysely-dialect-tauri'
import { SerializePlugin } from 'kysely-plugin-serialize'
import mitt from 'mitt'
import { shallowRef, triggerRef } from 'vue'

import type * as PluginArchiveDB from './plugin'
export * as PluginArchiveDB from './plugin'

import type * as FavouriteDB from './favourite'
export * as FavouriteDB from './favourite'

import type * as HistoryDB from './history'
export * as HistoryDB from './history'

import type * as ItemStoreDB from './itemStore'
export * as ItemStoreDB from './itemStore'

import type * as SubscribeDB from './subscribe'
export * as SubscribeDB from './subscribe'

import type * as RecentDB from './recentView'
export * as RecentDB from './recentView'

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
const database = useGlobalVar(await Database.load(`sqlite:app.db`), 'core/db/raw')

const emitter = mitt<{ onChange: void }>()

const MUTATION_KEYWORDS = /\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER)\b/i
const triggerUpdate = debounce(() => {
  console.debug('[db sync] db changed')
  emitter.emit('onChange')
  triggerRef(db)
}, 300)

export const db = useGlobalVar(
  await (async () => {
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
  })(),
  'core/db/ins'
)

export namespace DBUtils {
  export async function countDb(sql: SelectQueryBuilder<DB, any, object>) {
    const v = await sql.select(db => db.fn.countAll<number>().as('count')).executeTakeFirstOrThrow()
    return v.count
  }
}

export * from './nativeStore'