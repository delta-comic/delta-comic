import { Type } from 'typebox'

import { autoIncrement, defineTable, type TableSchema } from './schema.mts'

const syncCollection = Type.Union([
  Type.Literal('itemStore'),
  Type.Literal('favouriteCard'),
  Type.Literal('favouriteItem'),
  Type.Literal('history'),
  Type.Literal('recentView'),
  Type.Literal('subscribe'),
  Type.Literal('config'),
])
const syncAction = Type.Union([Type.Literal('upsert'), Type.Literal('delete')])
const syncOperationResult = Type.Union([
  Type.Literal('applied'),
  Type.Literal('replayed'),
  Type.Literal('ignored_stale'),
  Type.Literal('conflict'),
  Type.Literal('failed'),
])
const authUsersTable = defineTable(
  'auth_users',
  {
    id: Type.String(),
    login_name: Type.String({ minLength: 3, maxLength: 64 }),
    password_hash: Type.String(),
    password_salt: Type.String(),
    password_alg: Type.String(),
    created_at: Type.Integer(),
    updated_at: Type.Integer(),
    disabled_at: Type.Optional(Type.Integer()),
  },
  {
    primaryKey: ['id'],
    unique: [['login_name']],
    indexes: [{ name: 'idx_auth_users_login_name', columns: ['login_name'] }],
  },
)

const authTerminalsTable = defineTable(
  'auth_terminals',
  {
    user_id: Type.String(),
    terminal_uuid: Type.String(),
    display_name: Type.Optional(Type.String()),
    platform: Type.Optional(Type.String()),
    app_version: Type.Optional(Type.String()),
    created_at: Type.Integer(),
    last_seen_at: Type.Integer(),
    revoked_at: Type.Optional(Type.Integer()),
  },
  {
    primaryKey: ['user_id', 'terminal_uuid'],
    indexes: [
      {
        name: 'idx_auth_terminals_user_last_seen',
        columns: ['user_id', { column: 'last_seen_at', order: 'DESC' }],
      },
    ],
    foreignKeys: [
      { columns: ['user_id'], refTable: 'auth_users', refColumns: ['id'], onDelete: 'cascade' },
    ],
  },
)

const authSessionsTable = defineTable(
  'auth_sessions',
  {
    id: Type.String(),
    user_id: Type.String(),
    terminal_uuid: Type.String(),
    access_token_hash: Type.String(),
    refresh_token_hash: Type.String(),
    created_at: Type.Integer(),
    access_expires_at: Type.Integer(),
    refresh_expires_at: Type.Integer(),
    rotated_at: Type.Optional(Type.Integer()),
    revoked_at: Type.Optional(Type.Integer()),
  },
  {
    primaryKey: ['id'],
    unique: [['access_token_hash'], ['refresh_token_hash']],
    indexes: [
      { name: 'idx_auth_sessions_access_token_hash', columns: ['access_token_hash'] },
      { name: 'idx_auth_sessions_refresh_token_hash', columns: ['refresh_token_hash'] },
      { name: 'idx_auth_sessions_user_terminal', columns: ['user_id', 'terminal_uuid'] },
    ],
    foreignKeys: [
      {
        columns: ['user_id', 'terminal_uuid'],
        refTable: 'auth_terminals',
        refColumns: ['user_id', 'terminal_uuid'],
        onDelete: 'cascade',
      },
    ],
  },
)

const syncEntitiesTable = defineTable(
  'sync_entities',
  {
    user_id: Type.String(),
    collection: syncCollection,
    entity_id: Type.String(),
    data_json: Type.Optional(Type.String()),
    data_hash: Type.String(),
    version: Type.String(),
    client_changed_at: Type.Integer(),
    server_updated_at: Type.Integer(),
    deleted_at: Type.Optional(Type.Integer()),
    last_terminal_uuid: Type.String(),
    last_op_id: Type.String(),
  },
  {
    primaryKey: ['user_id', 'collection', 'entity_id'],
    indexes: [{ name: 'idx_sync_entities_user_collection', columns: ['user_id', 'collection'] }],
  },
)

const syncChangesTable = defineTable(
  'sync_changes',
  {
    server_seq: autoIncrement(),
    user_id: Type.String(),
    collection: syncCollection,
    entity_id: Type.String(),
    action: syncAction,
    data_json: Type.Optional(Type.String()),
    data_hash: Type.String(),
    version: Type.String(),
    client_changed_at: Type.Integer(),
    server_changed_at: Type.Integer(),
    deleted_at: Type.Optional(Type.Integer()),
    origin_terminal_uuid: Type.String(),
    origin_op_id: Type.String(),
  },
  {
    primaryKey: ['server_seq'],
    indexes: [
      { name: 'idx_sync_changes_user_seq', columns: ['user_id', 'server_seq'] },
      {
        name: 'idx_sync_changes_user_collection_seq',
        columns: ['user_id', 'collection', 'server_seq'],
      },
      {
        name: 'idx_sync_changes_origin_op',
        columns: ['user_id', 'origin_terminal_uuid', 'origin_op_id'],
        unique: true,
      },
    ],
  },
)

const syncOpsTable = defineTable(
  'sync_ops',
  {
    user_id: Type.String(),
    terminal_uuid: Type.String(),
    op_id: Type.String(),
    collection: syncCollection,
    entity_id: Type.String(),
    action: syncAction,
    data_hash: Type.String(),
    base_version: Type.Optional(Type.String()),
    result: syncOperationResult,
    server_seq: Type.Optional(Type.Integer()),
    entity_version: Type.Optional(Type.String()),
    error_code: Type.Optional(Type.String()),
    error_message: Type.Optional(Type.String()),
    received_at: Type.Integer(),
  },
  {
    primaryKey: ['user_id', 'terminal_uuid', 'op_id'],
    indexes: [
      {
        name: 'idx_sync_ops_user_received',
        columns: ['user_id', { column: 'received_at', order: 'DESC' }],
      },
    ],
  },
)

const syncTerminalCursorsTable = defineTable(
  'sync_terminal_cursors',
  {
    user_id: Type.String(),
    terminal_uuid: Type.String(),
    last_pulled_seq: Type.Integer({ default: 0 }),
    last_pushed_at: Type.Optional(Type.Integer()),
    last_seen_at: Type.Integer(),
  },
  { primaryKey: ['user_id', 'terminal_uuid'] },
)

const pluginPackagesTable = defineTable(
  'server_plugin_packages',
  {
    tenant_id: Type.String(),
    plugin_id: Type.String(),
    manifest_json: Type.String(),
    document_json: Type.String(),
    config_json: Type.String({ default: '{}' }),
    enabled: Type.Boolean({ default: true }),
    created_at: Type.Integer(),
    updated_at: Type.Integer(),
  },
  { primaryKey: ['tenant_id', 'plugin_id'] },
)

const pluginSchedulesTable = defineTable(
  'server_plugin_schedules',
  {
    tenant_id: Type.String(),
    plugin_id: Type.String(),
    flow_id: Type.String(),
    enabled: Type.Boolean({ default: false }),
    interval_hours: Type.Integer({ minimum: 1, maximum: 168 }),
    next_run_at: Type.Integer(),
    updated_at: Type.Integer(),
  },
  {
    primaryKey: ['tenant_id', 'plugin_id'],
    indexes: [{ name: 'idx_server_plugin_schedules_due', columns: ['enabled', 'next_run_at'] }],
    foreignKeys: [
      {
        columns: ['tenant_id', 'plugin_id'],
        refTable: 'server_plugin_packages',
        refColumns: ['tenant_id', 'plugin_id'],
        onDelete: 'cascade',
      },
    ],
  },
)

const pluginRunsTable = defineTable(
  'server_plugin_runs',
  {
    id: Type.String(),
    tenant_id: Type.String(),
    plugin_id: Type.String(),
    flow_id: Type.String(),
    trigger: Type.Union([Type.Literal('manual'), Type.Literal('scheduled')]),
    status: Type.Union([
      Type.Literal('running'),
      Type.Literal('succeeded'),
      Type.Literal('failed'),
    ]),
    input_json: Type.Optional(Type.String()),
    result_json: Type.Optional(Type.String()),
    step_id: Type.Optional(Type.String()),
    error_message: Type.Optional(Type.String()),
    metrics_json: Type.String(),
    started_at: Type.Integer(),
    completed_at: Type.Optional(Type.Integer()),
  },
  {
    primaryKey: ['id'],
    indexes: [
      {
        name: 'idx_server_plugin_runs_tenant_plugin_started',
        columns: ['tenant_id', 'plugin_id', { column: 'started_at', order: 'DESC' }],
      },
    ],
  },
)

const pluginStoreTable = defineTable(
  'server_plugin_store',
  {
    tenant_id: Type.String(),
    plugin_id: Type.String(),
    key: Type.String(),
    value_json: Type.String(),
  },
  {
    primaryKey: ['tenant_id', 'plugin_id', 'key'],
    foreignKeys: [
      {
        columns: ['tenant_id', 'plugin_id'],
        refTable: 'server_plugin_packages',
        refColumns: ['tenant_id', 'plugin_id'],
        onDelete: 'cascade',
      },
    ],
  },
)

export const serverTables: readonly TableSchema[] = [
  authUsersTable,
  authTerminalsTable,
  authSessionsTable,
  syncEntitiesTable,
  syncChangesTable,
  syncOpsTable,
  syncTerminalCursorsTable,
  pluginPackagesTable,
  pluginSchedulesTable,
  pluginRunsTable,
  pluginStoreTable,
]