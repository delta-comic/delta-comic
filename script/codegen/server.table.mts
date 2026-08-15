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
const pluginAction = Type.Union([
  Type.Literal('configure'),
  Type.Literal('disable'),
  Type.Literal('enable'),
  Type.Literal('health'),
  Type.Literal('install'),
  Type.Literal('register'),
  Type.Literal('uninstall'),
  Type.Literal('update'),
])
const pluginJobStatus = Type.Union([
  Type.Literal('failed'),
  Type.Literal('queued'),
  Type.Literal('running'),
  Type.Literal('succeeded'),
])

const authUsersTable = defineTable(
  'auth_users',
  {
    id: Type.String({ format: 'uuid' }),
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

const pluginRegistryTable = defineTable(
  'server_plugin_registry',
  {
    plugin_id: Type.String(),
    manifest_json: Type.String(),
    source: Type.String(),
    trusted: Type.Boolean({ default: true }),
    registered_at: Type.Integer(),
    updated_at: Type.Integer(),
  },
  {
    primaryKey: ['plugin_id'],
    indexes: [
      {
        name: 'idx_server_plugin_registry_updated',
        columns: [{ column: 'updated_at', order: 'DESC' }],
      },
    ],
  },
)

const pluginInstallationsTable = defineTable(
  'server_plugin_installations',
  {
    plugin_id: Type.String(),
    installed_version: Type.String(),
    desired_state: Type.Union([Type.Literal('disabled'), Type.Literal('enabled')]),
    observed_state: Type.Union([
      Type.Literal('disabled'),
      Type.Literal('enabled'),
      Type.Literal('failed'),
      Type.Literal('installed'),
    ]),
    config_json: Type.String({ default: '{}' }),
    installed_at: Type.Integer(),
    updated_at: Type.Integer(),
    last_error: Type.Optional(Type.String()),
    last_health_json: Type.Optional(Type.String()),
    last_health_at: Type.Optional(Type.Integer()),
  },
  {
    primaryKey: ['plugin_id'],
    indexes: [
      {
        name: 'idx_server_plugin_installations_state',
        columns: ['desired_state', 'observed_state', { column: 'updated_at', order: 'DESC' }],
      },
    ],
    foreignKeys: [
      {
        columns: ['plugin_id'],
        refTable: 'server_plugin_registry',
        refColumns: ['plugin_id'],
        onDelete: 'cascade',
      },
    ],
  },
)

const pluginJobsTable = defineTable(
  'server_plugin_jobs',
  {
    id: Type.String(),
    plugin_id: Type.String(),
    action: pluginAction,
    status: pluginJobStatus,
    result_json: Type.Optional(Type.String()),
    error_message: Type.Optional(Type.String()),
    created_at: Type.Integer(),
    started_at: Type.Optional(Type.Integer()),
    completed_at: Type.Optional(Type.Integer()),
    updated_at: Type.Integer(),
  },
  {
    primaryKey: ['id'],
    indexes: [
      {
        name: 'idx_server_plugin_jobs_plugin_created',
        columns: ['plugin_id', { column: 'created_at', order: 'DESC' }],
      },
      {
        name: 'idx_server_plugin_jobs_status_updated',
        columns: ['status', { column: 'updated_at', order: 'DESC' }],
      },
    ],
  },
)

const pluginAuditTable = defineTable(
  'server_plugin_audit',
  {
    id: Type.String(),
    plugin_id: Type.String(),
    job_id: Type.String(),
    action: pluginAction,
    outcome: Type.Union([Type.Literal('failed'), Type.Literal('succeeded')]),
    actor_id: Type.String(),
    detail_json: Type.Optional(Type.String()),
    created_at: Type.Integer(),
  },
  {
    primaryKey: ['id'],
    indexes: [
      {
        name: 'idx_server_plugin_audit_created',
        columns: [
          { column: 'created_at', order: 'DESC' },
          { column: 'id', order: 'DESC' },
        ],
      },
      {
        name: 'idx_server_plugin_audit_plugin_created',
        columns: ['plugin_id', { column: 'created_at', order: 'DESC' }],
      },
    ],
    foreignKeys: [
      {
        columns: ['job_id'],
        refTable: 'server_plugin_jobs',
        refColumns: ['id'],
        onDelete: 'cascade',
      },
    ],
  },
)

const pluginScriptsTable = defineTable(
  'server_plugin_scripts',
  {
    plugin_id: Type.String(),
    source: Type.String(),
    enabled: Type.Boolean({ default: false }),
    interval_hours: Type.Integer({ minimum: 1, maximum: 168, default: 1 }),
    next_run_at: Type.Integer(),
    created_at: Type.Integer(),
    updated_at: Type.Integer(),
  },
  {
    primaryKey: ['plugin_id'],
    indexes: [
      {
        name: 'idx_server_plugin_scripts_due',
        columns: ['enabled', { column: 'next_run_at', order: 'ASC' }],
      },
    ],
    foreignKeys: [
      {
        columns: ['plugin_id'],
        refTable: 'server_plugin_installations',
        refColumns: ['plugin_id'],
        onDelete: 'cascade',
      },
    ],
  },
)

const pluginScriptRunsTable = defineTable(
  'server_plugin_script_runs',
  {
    id: Type.String(),
    plugin_id: Type.String(),
    trigger: Type.Union([Type.Literal('manual'), Type.Literal('scheduled')]),
    status: Type.Union([Type.Literal('failed'), Type.Literal('succeeded')]),
    input_json: Type.Optional(Type.String()),
    result_json: Type.Optional(Type.String()),
    error_message: Type.Optional(Type.String()),
    started_at: Type.Integer(),
    completed_at: Type.Integer(),
  },
  {
    primaryKey: ['id'],
    indexes: [
      {
        name: 'idx_server_plugin_script_runs_plugin_started',
        columns: ['plugin_id', { column: 'started_at', order: 'DESC' }],
      },
    ],
    foreignKeys: [
      {
        columns: ['plugin_id'],
        refTable: 'server_plugin_scripts',
        refColumns: ['plugin_id'],
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
  pluginRegistryTable,
  pluginInstallationsTable,
  pluginJobsTable,
  pluginAuditTable,
  pluginScriptsTable,
  pluginScriptRunsTable,
]