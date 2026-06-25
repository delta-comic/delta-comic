import Database from '@tauri-apps/plugin-sql'
import { CamelCasePlugin, Kysely } from 'kysely'
import { TauriSqliteDialect } from 'kysely-dialect-tauri'
import { SerializePlugin } from 'kysely-plugin-serialize'

import type * as FavouriteDB from './favourite'
export * as PluginArchiveDB from './plugin'
import type * as HistoryDB from './history'
export * as FavouriteDB from './favourite'
import type * as ItemStoreDB from './itemStore'
import type * as NativeStoreDB from './nativeStore'
import type * as ConfigDB from './config'
export * as HistoryDB from './history'
import type * as PluginArchiveDB from './plugin'
export * as ItemStoreDB from './itemStore'
import type * as RecentDB from './recentView'
export * as SubscribeDB from './subscribe'
import type * as SubscribeDB from './subscribe'
export * as RecentDB from './recentView'
export * as ConfigDB from './config'

export interface DB {
  itemStore: ItemStoreDB.Table
  favouriteCard: FavouriteDB.CardTable
  favouriteItem: FavouriteDB.ItemTable
  history: HistoryDB.Table
  recentView: RecentDB.Table
  subscribe: SubscribeDB.Table
  plugin: PluginArchiveDB.Table
  nativeStore: NativeStoreDB.Table
  config: ConfigDB.Table
}

console.log('[db] loading')
const database = await Database.load(`sqlite:app.db`)

export const db = await (async () => {
  return new Kysely<DB>({
    dialect: new TauriSqliteDialect({ database }),
    plugins: [new CamelCasePlugin(), new SerializePlugin()],
  })
})()

export * as DBUtils from './utils'

export * from './nativeStore'
export { useConfig } from './config'
