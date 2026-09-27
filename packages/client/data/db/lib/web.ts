import { CompiledQuery, type Dialect } from 'kysely'
import { WaSqliteWorkerDialect } from 'kysely-wasqlite-worker'

export const WEB_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS item_store (
    key TEXT PRIMARY KEY NOT NULL,
    item TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS item_store_key ON item_store (key)',
  `CREATE TABLE IF NOT EXISTS history (
    ep TEXT NOT NULL,
    timestamp DATETIME PRIMARY KEY NOT NULL,
    item_key TEXT NOT NULL UNIQUE,
    CONSTRAINT item_key_foreign FOREIGN KEY (item_key) REFERENCES item_store (key) ON DELETE CASCADE
  )`,
  'CREATE INDEX IF NOT EXISTS history_timestamp ON history (timestamp DESC)',
  `CREATE TABLE IF NOT EXISTS recent_view (
    timestamp DATETIME PRIMARY KEY NOT NULL,
    item_key TEXT NOT NULL UNIQUE,
    is_viewed BOOLEAN NOT NULL,
    CONSTRAINT item_key_foreign FOREIGN KEY (item_key) REFERENCES item_store (key) ON DELETE CASCADE
  )`,
  'CREATE INDEX IF NOT EXISTS recent_timestamp ON recent_view (timestamp DESC)',
  `CREATE TABLE IF NOT EXISTS favourite_card (
    create_at DATETIME PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    private BOOLEAN NOT NULL,
    description TEXT NOT NULL
  )`,
  `INSERT OR IGNORE INTO favourite_card (create_at, title, private, description)
   VALUES (0, '默认收藏夹', 0, '')`,
  `CREATE INDEX IF NOT EXISTS favourite_card_title_create_at
   ON favourite_card (create_at DESC, title)`,
  `CREATE TABLE IF NOT EXISTS favourite_item (
    add_time DATETIME NOT NULL,
    belong_to INTEGER NOT NULL,
    item_key TEXT NOT NULL,
    CONSTRAINT primary_key PRIMARY KEY (add_time, belong_to, item_key),
    CONSTRAINT unique_key UNIQUE (belong_to, item_key),
    CONSTRAINT item_key_foreign FOREIGN KEY (item_key) REFERENCES item_store (key) ON DELETE CASCADE,
    CONSTRAINT belong_to_foreign FOREIGN KEY (belong_to) REFERENCES favourite_card (create_at) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS favourite_item_belong_to_add_time
   ON favourite_item (add_time DESC, belong_to)`,
  `CREATE TABLE IF NOT EXISTS subscribe (
    item_key TEXT,
    author TEXT,
    type TEXT NOT NULL,
    key TEXT NOT NULL,
    plugin TEXT NOT NULL,
    CONSTRAINT item_key_foreign FOREIGN KEY (item_key) REFERENCES item_store (key) ON DELETE CASCADE,
    CONSTRAINT primary_key PRIMARY KEY (plugin, key)
  )`,
  'CREATE INDEX IF NOT EXISTS subscribe_key_plugin ON subscribe (key, plugin)',
  `CREATE TABLE IF NOT EXISTS plugin (
    installer_name TEXT NOT NULL,
    loader_name TEXT NOT NULL,
    plugin_name TEXT PRIMARY KEY NOT NULL,
    meta JSON NOT NULL,
    enable TEXT NOT NULL,
    install_input TEXT NOT NULL,
    display_name TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS plugin_enable ON plugin (enable)',
  'CREATE INDEX IF NOT EXISTS plugin_plugin_name ON plugin (plugin_name)',
  `CREATE TABLE IF NOT EXISTS native_store (
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    CONSTRAINT primary_key PRIMARY KEY (namespace, key)
  )`,
  'CREATE INDEX IF NOT EXISTS native_store_namespace_key ON native_store (namespace, key)',
  `CREATE TABLE IF NOT EXISTS config (
    belong_to TEXT PRIMARY KEY NOT NULL,
    form TEXT NOT NULL,
    data TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS config_belong_to ON config (belong_to)',
] as const

export const createWebDialect = (): Dialect =>
  new WaSqliteWorkerDialect({
    fileName: 'delta-comic.db',
    onCreateConnection: async connection => {
      await connection.executeQuery(CompiledQuery.raw('PRAGMA foreign_keys = ON'))
      for (const statement of WEB_SCHEMA_STATEMENTS) {
        await connection.executeQuery(CompiledQuery.raw(statement))
      }
    },
    preferOPFS: true,
  })