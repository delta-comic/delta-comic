import { isTauri } from '@tauri-apps/api/core'
import { CamelCasePlugin, type Dialect, Kysely } from 'kysely'
import { SerializePlugin } from 'kysely-plugin-serialize'

import type * as FavouriteDB from './favourite'
export * as PluginArchiveDB from './plugin'
import type * as HistoryDB from './history'
export * as FavouriteDB from './favourite'
import type * as ConfigDB from './config'
import type * as ItemStoreDB from './itemStore'
import type * as NativeStoreDB from './nativeStore'
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

export const isTauriRuntime = isTauri

const createDialect = async (): Promise<Dialect> => {
  if (isTauriRuntime()) {
    const [{ default: Database }, { TauriSqliteDialect }] = await Promise.all([
      import('@tauri-apps/plugin-sql'),
      import('kysely-dialect-tauri'),
    ])
    const database = await Database.load('sqlite:app.db')
    return new TauriSqliteDialect({ database })
  }

  const { createWebDialect } = await import('./web')
  return createWebDialect()
}

export const db = new Kysely<DB>({
  dialect: await createDialect(),
  plugins: [new CamelCasePlugin(), new SerializePlugin()],
})

export * as DBUtils from './utils'

export * from './nativeStore'
export { useConfig } from './config'