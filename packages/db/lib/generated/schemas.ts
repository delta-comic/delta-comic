import type { TSchema } from 'typebox'

/** Runtime SQLite row schema for item_store. */
export const itemStoreRowSchema = {
  type: 'object',
  properties: { key: { type: 'string' }, item: { type: 'string' } },
  required: ['key', 'item'],
  additionalProperties: false,
} as const

/** Runtime SQLite row schema for favourite_card. */
export const favouriteCardRowSchema = {
  type: 'object',
  properties: {
    create_at: { type: 'integer' },
    title: { type: 'string' },
    private: { type: 'integer' },
    description: { type: 'string' },
  },
  required: ['create_at', 'title', 'private', 'description'],
  additionalProperties: false,
} as const

/** Runtime SQLite row schema for favourite_item. */
export const favouriteItemRowSchema = {
  type: 'object',
  properties: {
    add_time: { type: 'integer' },
    belong_to: { type: 'integer' },
    item_key: { type: 'string' },
  },
  required: ['add_time', 'belong_to', 'item_key'],
  additionalProperties: false,
} as const

/** Runtime SQLite row schema for history. */
export const historyRowSchema = {
  type: 'object',
  properties: {
    ep: { type: 'string' },
    timestamp: { type: 'integer' },
    item_key: { type: 'string' },
  },
  required: ['ep', 'timestamp', 'item_key'],
  additionalProperties: false,
} as const

/** Runtime SQLite row schema for recent_view. */
export const recentViewRowSchema = {
  type: 'object',
  properties: {
    timestamp: { type: 'integer' },
    item_key: { type: 'string' },
    is_viewed: { type: 'integer' },
  },
  required: ['timestamp', 'item_key', 'is_viewed'],
  additionalProperties: false,
} as const

/** Runtime SQLite row schema for subscribe. */
export const subscribeRowSchema = {
  type: 'object',
  properties: {
    item_key: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    author: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    type: { type: 'string' },
    key: { type: 'string' },
    plugin: { type: 'string' },
  },
  required: ['item_key', 'author', 'type', 'key', 'plugin'],
  additionalProperties: false,
} as const

/** Runtime SQLite row schema for plugin. */
export const pluginRowSchema = {
  type: 'object',
  properties: {
    installer_name: { type: 'string' },
    loader_name: { type: 'string' },
    plugin_name: { type: 'string' },
    meta: { type: 'string' },
    enable: { type: 'integer' },
    install_input: { type: 'string' },
    display_name: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
  required: [
    'installer_name',
    'loader_name',
    'plugin_name',
    'meta',
    'enable',
    'install_input',
    'display_name',
  ],
  additionalProperties: false,
} as const

/** Runtime SQLite row schema for native_store. */
export const nativeStoreRowSchema = {
  type: 'object',
  properties: { namespace: { type: 'string' }, key: { type: 'string' }, value: { type: 'string' } },
  required: ['namespace', 'key', 'value'],
  additionalProperties: false,
} as const

/** Runtime SQLite row schema for config. */
export const configRowSchema = {
  type: 'object',
  properties: { belong_to: { type: 'string' }, form: { type: 'string' }, data: { type: 'string' } },
  required: ['belong_to', 'form', 'data'],
  additionalProperties: false,
} as const

/** Runtime TS-level row schema for item_store (camelCase keys). */
export const itemStoreCamelRowSchema = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    item: { anyOf: [{ type: 'object' }, { type: 'string' }] },
  },
  required: ['key', 'item'],
  additionalProperties: false,
} as const

/** Runtime TS-level row schema for favourite_card (camelCase keys). */
export const favouriteCardCamelRowSchema = {
  type: 'object',
  properties: {
    createAt: { type: 'integer' },
    title: { type: 'string' },
    private: { anyOf: [{ type: 'boolean' }, { const: 0 }, { const: 1 }] },
    description: { type: 'string' },
  },
  required: ['createAt', 'title', 'private', 'description'],
  additionalProperties: false,
} as const

/** Runtime TS-level row schema for favourite_item (camelCase keys). */
export const favouriteItemCamelRowSchema = {
  type: 'object',
  properties: {
    addTime: { type: 'integer' },
    belongTo: { type: 'integer' },
    itemKey: { type: 'string' },
  },
  required: ['addTime', 'belongTo', 'itemKey'],
  additionalProperties: false,
} as const

/** Runtime TS-level row schema for history (camelCase keys). */
export const historyCamelRowSchema = {
  type: 'object',
  properties: {
    ep: { anyOf: [{ type: 'object' }, { type: 'string' }] },
    timestamp: { type: 'integer' },
    itemKey: { type: 'string' },
  },
  required: ['ep', 'timestamp', 'itemKey'],
  additionalProperties: false,
} as const

/** Runtime TS-level row schema for recent_view (camelCase keys). */
export const recentViewCamelRowSchema = {
  type: 'object',
  properties: {
    timestamp: { type: 'integer' },
    itemKey: { type: 'string' },
    isViewed: { anyOf: [{ type: 'boolean' }, { const: 0 }, { const: 1 }] },
  },
  required: ['timestamp', 'itemKey', 'isViewed'],
  additionalProperties: false,
} as const

/** Runtime TS-level row schema for subscribe (camelCase keys). */
export const subscribeCamelRowSchema = {
  type: 'object',
  properties: {
    itemKey: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    author: { anyOf: [{ type: 'object' }, { type: 'string' }, { type: 'null' }] },
    type: { type: 'string' },
    key: { type: 'string' },
    plugin: { type: 'string' },
  },
  required: ['itemKey', 'author', 'type', 'key', 'plugin'],
  additionalProperties: false,
} as const

/** Runtime TS-level row schema for plugin (camelCase keys). */
export const pluginCamelRowSchema = {
  type: 'object',
  properties: {
    installerName: { type: 'string' },
    loaderName: { type: 'string' },
    pluginName: { type: 'string' },
    meta: { anyOf: [{ type: 'object' }, { type: 'string' }] },
    enable: { anyOf: [{ type: 'boolean' }, { const: 0 }, { const: 1 }] },
    installInput: { type: 'string' },
    displayName: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
  required: [
    'installerName',
    'loaderName',
    'pluginName',
    'meta',
    'enable',
    'installInput',
    'displayName',
  ],
  additionalProperties: false,
} as const

/** Runtime TS-level row schema for native_store (camelCase keys). */
export const nativeStoreCamelRowSchema = {
  type: 'object',
  properties: { namespace: { type: 'string' }, key: { type: 'string' }, value: { type: 'string' } },
  required: ['namespace', 'key', 'value'],
  additionalProperties: false,
} as const

/** Runtime TS-level row schema for config (camelCase keys). */
export const configCamelRowSchema = {
  type: 'object',
  properties: { belongTo: { type: 'string' }, form: { type: 'string' }, data: { type: 'string' } },
  required: ['belongTo', 'form', 'data'],
  additionalProperties: false,
} as const

export const clientRowSchemas = {
  item_store: itemStoreRowSchema,
  favourite_card: favouriteCardRowSchema,
  favourite_item: favouriteItemRowSchema,
  history: historyRowSchema,
  recent_view: recentViewRowSchema,
  subscribe: subscribeRowSchema,
  plugin: pluginRowSchema,
  native_store: nativeStoreRowSchema,
  config: configRowSchema,
} satisfies Record<string, TSchema>
export const clientCamelRowSchemas = {
  itemStore: itemStoreCamelRowSchema,
  favouriteCard: favouriteCardCamelRowSchema,
  favouriteItem: favouriteItemCamelRowSchema,
  history: historyCamelRowSchema,
  recentView: recentViewCamelRowSchema,
  subscribe: subscribeCamelRowSchema,
  plugin: pluginCamelRowSchema,
  nativeStore: nativeStoreCamelRowSchema,
  config: configCamelRowSchema,
} satisfies Record<string, TSchema>