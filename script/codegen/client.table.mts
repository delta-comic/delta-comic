import { Type } from 'typebox'

import { defineTable, jsonColumn, type TableSchema } from './schema.mts'

const model = '@delta-comic/model'

const itemStoreTable = defineTable(
  'item_store',
  { key: Type.String(), item: jsonColumn('UniItemRaw', model) },
  { primaryKey: ['key'], indexes: [{ name: 'item_store_key', columns: ['key'] }] },
  { kyselyCamelCase: true },
)

const historyTable = defineTable(
  'history',
  { ep: jsonColumn('UniEpRaw', model), timestamp: Type.Integer(), item_key: Type.String() },
  {
    primaryKey: ['timestamp'],
    unique: [['item_key']],
    indexes: [{ name: 'history_timestamp', columns: [{ column: 'timestamp', order: 'DESC' }] }],
  },
  { kyselyCamelCase: true },
)

const recentViewTable = defineTable(
  'recent_view',
  { timestamp: Type.Integer(), item_key: Type.String(), is_viewed: Type.Boolean() },
  {
    primaryKey: ['timestamp'],
    unique: [['item_key']],
    indexes: [{ name: 'recent_timestamp', columns: [{ column: 'timestamp', order: 'DESC' }] }],
  },
  { kyselyCamelCase: true },
)

const favouriteCardTable = defineTable(
  'favourite_card',
  {
    create_at: Type.Integer(),
    title: Type.String(),
    private: Type.Boolean(),
    description: Type.String(),
  },
  {
    primaryKey: ['create_at'],
    indexes: [
      {
        name: 'favourite_card_title_create_at',
        columns: [{ column: 'create_at', order: 'DESC' }, 'title'],
      },
    ],
  },
  { kyselyCamelCase: true },
)

const favouriteItemTable = defineTable(
  'favourite_item',
  { add_time: Type.Integer(), belong_to: Type.Integer(), item_key: Type.String() },
  {
    primaryKey: ['add_time', 'belong_to', 'item_key'],
    unique: [['belong_to', 'item_key']],
    indexes: [
      {
        name: 'favourite_item_belong_to_add_time',
        columns: [{ column: 'add_time', order: 'DESC' }, 'belong_to'],
      },
    ],
  },
  { kyselyCamelCase: true },
)

const subscribeTable = defineTable(
  'subscribe',
  {
    item_key: Type.Optional(Type.String()),
    author: Type.Optional(jsonColumn('UniItemAuthor', model)),
    type: Type.String(),
    key: Type.String(),
    plugin: Type.String(),
  },
  {
    primaryKey: ['plugin', 'key'],
    indexes: [{ name: 'subscribe_key_plugin', columns: ['key', 'plugin'] }],
  },
  { kyselyCamelCase: true },
)

const pluginTable = defineTable(
  'plugin',
  {
    installer_name: Type.String(),
    loader_name: Type.String(),
    plugin_name: Type.String(),
    meta: jsonColumn('PluginManifest', model),
    enable: Type.Boolean(),
    install_input: Type.String(),
    display_name: Type.Optional(Type.String()),
  },
  {
    primaryKey: ['plugin_name'],
    indexes: [
      { name: 'plugin_enable', columns: ['enable'] },
      { name: 'plugin_plugin_name', columns: ['plugin_name'] },
    ],
  },
  { kyselyCamelCase: true },
)

const nativeStoreTable = defineTable(
  'native_store',
  { namespace: Type.String(), key: Type.String(), value: Type.String() },
  {
    primaryKey: ['namespace', 'key'],
    indexes: [{ name: 'native_store_namespace_key', columns: ['namespace', 'key'] }],
  },
  { kyselyCamelCase: true },
)

const configTable = defineTable(
  'config',
  { belong_to: Type.String(), form: Type.String(), data: Type.String() },
  { primaryKey: ['belong_to'], indexes: [{ name: 'config_belong_to', columns: ['belong_to'] }] },
  { kyselyCamelCase: true },
)

export const clientTables: readonly TableSchema[] = [
  itemStoreTable,
  favouriteCardTable,
  favouriteItemTable,
  historyTable,
  recentViewTable,
  subscribeTable,
  pluginTable,
  nativeStoreTable,
  configTable,
]