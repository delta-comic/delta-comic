import type { TSchema } from 'typebox'

/** Runtime SQLite row schema for auth_users. */
export const authUsersRowSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    login_name: { type: 'string', minLength: 3, maxLength: 64 },
    password_hash: { type: 'string' },
    password_salt: { type: 'string' },
    password_alg: { type: 'string' },
    created_at: { type: 'integer' },
    updated_at: { type: 'integer' },
    disabled_at: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
  },
  required: [
    'id',
    'login_name',
    'password_hash',
    'password_salt',
    'password_alg',
    'created_at',
    'updated_at',
    'disabled_at',
  ],
  additionalProperties: false,
} as const

/** Runtime SQLite row schema for auth_terminals. */
export const authTerminalsRowSchema = {
  type: 'object',
  properties: {
    user_id: { type: 'string' },
    terminal_uuid: { type: 'string' },
    display_name: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    platform: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    app_version: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    created_at: { type: 'integer' },
    last_seen_at: { type: 'integer' },
    revoked_at: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
  },
  required: [
    'user_id',
    'terminal_uuid',
    'display_name',
    'platform',
    'app_version',
    'created_at',
    'last_seen_at',
    'revoked_at',
  ],
  additionalProperties: false,
} as const

/** Runtime SQLite row schema for auth_sessions. */
export const authSessionsRowSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    user_id: { type: 'string' },
    terminal_uuid: { type: 'string' },
    access_token_hash: { type: 'string' },
    refresh_token_hash: { type: 'string' },
    created_at: { type: 'integer' },
    access_expires_at: { type: 'integer' },
    refresh_expires_at: { type: 'integer' },
    rotated_at: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    revoked_at: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
  },
  required: [
    'id',
    'user_id',
    'terminal_uuid',
    'access_token_hash',
    'refresh_token_hash',
    'created_at',
    'access_expires_at',
    'refresh_expires_at',
    'rotated_at',
    'revoked_at',
  ],
  additionalProperties: false,
} as const

/** Runtime SQLite row schema for sync_entities. */
export const syncEntitiesRowSchema = {
  type: 'object',
  properties: {
    user_id: { type: 'string' },
    collection: {
      anyOf: [
        { type: 'string', const: 'itemStore' },
        { type: 'string', const: 'favouriteCard' },
        { type: 'string', const: 'favouriteItem' },
        { type: 'string', const: 'history' },
        { type: 'string', const: 'recentView' },
        { type: 'string', const: 'subscribe' },
        { type: 'string', const: 'config' },
      ],
    },
    entity_id: { type: 'string' },
    data_json: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    data_hash: { type: 'string' },
    version: { type: 'string' },
    client_changed_at: { type: 'integer' },
    server_updated_at: { type: 'integer' },
    deleted_at: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    last_terminal_uuid: { type: 'string' },
    last_op_id: { type: 'string' },
  },
  required: [
    'user_id',
    'collection',
    'entity_id',
    'data_json',
    'data_hash',
    'version',
    'client_changed_at',
    'server_updated_at',
    'deleted_at',
    'last_terminal_uuid',
    'last_op_id',
  ],
  additionalProperties: false,
} as const

/** Runtime SQLite row schema for sync_changes. */
export const syncChangesRowSchema = {
  type: 'object',
  properties: {
    server_seq: { type: 'integer' },
    user_id: { type: 'string' },
    collection: {
      anyOf: [
        { type: 'string', const: 'itemStore' },
        { type: 'string', const: 'favouriteCard' },
        { type: 'string', const: 'favouriteItem' },
        { type: 'string', const: 'history' },
        { type: 'string', const: 'recentView' },
        { type: 'string', const: 'subscribe' },
        { type: 'string', const: 'config' },
      ],
    },
    entity_id: { type: 'string' },
    action: {
      anyOf: [
        { type: 'string', const: 'upsert' },
        { type: 'string', const: 'delete' },
      ],
    },
    data_json: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    data_hash: { type: 'string' },
    version: { type: 'string' },
    client_changed_at: { type: 'integer' },
    server_changed_at: { type: 'integer' },
    deleted_at: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    origin_terminal_uuid: { type: 'string' },
    origin_op_id: { type: 'string' },
  },
  required: [
    'server_seq',
    'user_id',
    'collection',
    'entity_id',
    'action',
    'data_json',
    'data_hash',
    'version',
    'client_changed_at',
    'server_changed_at',
    'deleted_at',
    'origin_terminal_uuid',
    'origin_op_id',
  ],
  additionalProperties: false,
} as const

/** Runtime SQLite row schema for sync_ops. */
export const syncOpsRowSchema = {
  type: 'object',
  properties: {
    user_id: { type: 'string' },
    terminal_uuid: { type: 'string' },
    op_id: { type: 'string' },
    collection: {
      anyOf: [
        { type: 'string', const: 'itemStore' },
        { type: 'string', const: 'favouriteCard' },
        { type: 'string', const: 'favouriteItem' },
        { type: 'string', const: 'history' },
        { type: 'string', const: 'recentView' },
        { type: 'string', const: 'subscribe' },
        { type: 'string', const: 'config' },
      ],
    },
    entity_id: { type: 'string' },
    action: {
      anyOf: [
        { type: 'string', const: 'upsert' },
        { type: 'string', const: 'delete' },
      ],
    },
    data_hash: { type: 'string' },
    base_version: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    result: {
      anyOf: [
        { type: 'string', const: 'applied' },
        { type: 'string', const: 'replayed' },
        { type: 'string', const: 'ignored_stale' },
        { type: 'string', const: 'conflict' },
        { type: 'string', const: 'failed' },
      ],
    },
    server_seq: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    entity_version: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    error_code: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    error_message: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    received_at: { type: 'integer' },
  },
  required: [
    'user_id',
    'terminal_uuid',
    'op_id',
    'collection',
    'entity_id',
    'action',
    'data_hash',
    'base_version',
    'result',
    'server_seq',
    'entity_version',
    'error_code',
    'error_message',
    'received_at',
  ],
  additionalProperties: false,
} as const

/** Runtime SQLite row schema for sync_terminal_cursors. */
export const syncTerminalCursorsRowSchema = {
  type: 'object',
  properties: {
    user_id: { type: 'string' },
    terminal_uuid: { type: 'string' },
    last_pulled_seq: { type: 'integer' },
    last_pushed_at: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    last_seen_at: { type: 'integer' },
  },
  required: ['user_id', 'terminal_uuid', 'last_pulled_seq', 'last_pushed_at', 'last_seen_at'],
  additionalProperties: false,
} as const

/** Runtime SQLite row schema for server_plugin_packages. */
export const serverPluginPackagesRowSchema = {
  type: 'object',
  properties: {
    tenant_id: { type: 'string' },
    plugin_id: { type: 'string' },
    manifest_json: { type: 'string' },
    document_json: { type: 'string' },
    config_json: { type: 'string' },
    enabled: { type: 'integer' },
    created_at: { type: 'integer' },
    updated_at: { type: 'integer' },
  },
  required: [
    'tenant_id',
    'plugin_id',
    'manifest_json',
    'document_json',
    'config_json',
    'enabled',
    'created_at',
    'updated_at',
  ],
  additionalProperties: false,
} as const

/** Runtime SQLite row schema for server_plugin_schedules. */
export const serverPluginSchedulesRowSchema = {
  type: 'object',
  properties: {
    tenant_id: { type: 'string' },
    plugin_id: { type: 'string' },
    flow_id: { type: 'string' },
    enabled: { type: 'integer' },
    interval_hours: { type: 'integer', minimum: 1, maximum: 168 },
    next_run_at: { type: 'integer' },
    updated_at: { type: 'integer' },
  },
  required: [
    'tenant_id',
    'plugin_id',
    'flow_id',
    'enabled',
    'interval_hours',
    'next_run_at',
    'updated_at',
  ],
  additionalProperties: false,
} as const

/** Runtime SQLite row schema for server_plugin_runs. */
export const serverPluginRunsRowSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    tenant_id: { type: 'string' },
    plugin_id: { type: 'string' },
    flow_id: { type: 'string' },
    trigger: {
      anyOf: [
        { type: 'string', const: 'manual' },
        { type: 'string', const: 'scheduled' },
      ],
    },
    status: {
      anyOf: [
        { type: 'string', const: 'running' },
        { type: 'string', const: 'succeeded' },
        { type: 'string', const: 'failed' },
      ],
    },
    input_json: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    result_json: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    step_id: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    error_message: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    metrics_json: { type: 'string' },
    started_at: { type: 'integer' },
    completed_at: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
  },
  required: [
    'id',
    'tenant_id',
    'plugin_id',
    'flow_id',
    'trigger',
    'status',
    'input_json',
    'result_json',
    'step_id',
    'error_message',
    'metrics_json',
    'started_at',
    'completed_at',
  ],
  additionalProperties: false,
} as const

/** Runtime SQLite row schema for server_plugin_store. */
export const serverPluginStoreRowSchema = {
  type: 'object',
  properties: {
    tenant_id: { type: 'string' },
    plugin_id: { type: 'string' },
    key: { type: 'string' },
    value_json: { type: 'string' },
  },
  required: ['tenant_id', 'plugin_id', 'key', 'value_json'],
  additionalProperties: false,
} as const

export const serverRowSchemas = {
  auth_users: authUsersRowSchema,
  auth_terminals: authTerminalsRowSchema,
  auth_sessions: authSessionsRowSchema,
  sync_entities: syncEntitiesRowSchema,
  sync_changes: syncChangesRowSchema,
  sync_ops: syncOpsRowSchema,
  sync_terminal_cursors: syncTerminalCursorsRowSchema,
  server_plugin_packages: serverPluginPackagesRowSchema,
  server_plugin_schedules: serverPluginSchedulesRowSchema,
  server_plugin_runs: serverPluginRunsRowSchema,
  server_plugin_store: serverPluginStoreRowSchema,
} satisfies Record<string, TSchema>