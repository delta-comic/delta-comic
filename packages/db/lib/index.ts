import { useGlobalVar } from '@delta-comic/utils'
import Database from '@tauri-apps/plugin-sql'
import { CamelCasePlugin, Kysely, Migrator, type Migration } from 'kysely'
import { TauriSqliteDialect } from 'kysely-dialect-tauri'
import { SerializePlugin } from 'kysely-plugin-serialize'

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

export const db = useGlobalVar(
  await (async () => {
    const db = new Kysely<DB>({
      dialect: new TauriSqliteDialect({ database }),
      plugins: [new CamelCasePlugin(), new SerializePlugin()]
    })

    const migrator = new Migrator({
      db,
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

export * as DBUtils from './utils'

export * from './nativeStore'