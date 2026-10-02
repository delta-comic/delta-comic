import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { Type } from 'typebox'
import { describe, expect, it } from 'vite-plus/test'

import { autoIncrement, defineTable, jsonColumn, type TableSchema } from '../../codegen/schema.mts'
import { serverTables } from '../../codegen/server.table.mts'
import { generateIndexSql, generateTableSql } from '../../codegen/sql.mts'
import { rootDir } from '../../set-version.mts'

const authUsersTable = defineTable(
  'auth_users',
  {
    id: Type.String(),
    login_name: Type.String(),
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
    collection: Type.String(),
    entity_id: Type.String(),
    data_json: Type.Optional(jsonColumn('SyncEntityData')),
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
    collection: Type.String(),
    entity_id: Type.String(),
    action: Type.String(),
    data_json: Type.Optional(jsonColumn('SyncChangeData')),
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
    collection: Type.String(),
    entity_id: Type.String(),
    action: Type.String(),
    data_hash: Type.String(),
    base_version: Type.Optional(Type.String()),
    result: Type.String(),
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

const tables = [
  authUsersTable,
  authTerminalsTable,
  authSessionsTable,
  syncEntitiesTable,
  syncChangesTable,
  syncOpsTable,
  syncTerminalCursorsTable,
  ...serverTables.filter(table => table.name.startsWith('server_plugin_')),
]

const generatedSql = (table: TableSchema): string =>
  [generateTableSql(table), ...generateIndexSql(table)].join(';\n')

const runMigration = (db: DatabaseSync): void => {
  for (const name of [
    '0001_auth.sql',
    '0002_sync.sql',
    '0003_server_plugins.sql',
    '0004_server_plugin_scripts.sql',
    '0005_plugin_flows.sql',
    '0006_remove_legacy_plugin_tables.sql',
  ]) {
    db.exec(readFileSync(join(rootDir, 'packages/server/core/server/migrations', name), 'utf8'))
  }
}

const runGenerated = (db: DatabaseSync): void => {
  for (const table of tables) db.exec(generatedSql(table))
}

const tableInfo = (db: DatabaseSync, table: string): unknown[] =>
  db.prepare(`PRAGMA table_info("${table}")`).all() as unknown[]

const indexList = (db: DatabaseSync, table: string): unknown[] =>
  db.prepare(`PRAGMA index_list("${table}")`).all() as unknown[]

const indexInfo = (db: DatabaseSync, index: string): unknown[] =>
  db.prepare(`PRAGMA index_info("${index}")`).all() as unknown[]

const foreignKeyList = (db: DatabaseSync, table: string): unknown[] =>
  db.prepare(`PRAGMA foreign_key_list("${table}")`).all() as unknown[]

describe('sql codegen', () => {
  it('builds a table that matches the committed migration semantically', () => {
    const expected = new DatabaseSync(':memory:')
    const actual = new DatabaseSync(':memory:')
    runMigration(expected)
    runGenerated(actual)

    for (const table of tables) {
      expect(tableInfo(actual, table.name)).toEqual(tableInfo(expected, table.name))
      expect(indexList(actual, table.name)).toEqual(indexList(expected, table.name))
      expect(foreignKeyList(actual, table.name)).toEqual(foreignKeyList(expected, table.name))
    }

    const expectedIndexes = expected
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL`)
      .all() as unknown as { name: string }[]
    for (const { name } of expectedIndexes) {
      expect(indexInfo(actual, name)).toEqual(indexInfo(expected, name))
    }
  })

  it('renders NOT NULL and nullable columns', () => {
    const sql = generateTableSql(authUsersTable)
    expect(sql).toContain('"id" text not null primary key')
    expect(sql).toContain('"disabled_at" integer')
    expect(sql).not.toContain('"disabled_at" integer not null')
  })

  it('renders single-column unique inline and composite primary key as a constraint', () => {
    const users = generateTableSql(authUsersTable)
    const terminals = generateTableSql(authTerminalsTable)
    expect(users).toContain('"login_name" text not null unique')
    expect(terminals).toContain(
      'constraint "pk_auth_terminals" primary key ("user_id", "terminal_uuid")',
    )
  })

  it('renders foreign keys with cascade delete and composite foreign keys', () => {
    const terminals = generateTableSql(authTerminalsTable)
    const sessions = generateTableSql(authSessionsTable)
    expect(terminals).toContain(
      'constraint "fk_auth_terminals_user_id" foreign key ("user_id") references "auth_users" ("id") on delete cascade',
    )
    expect(sessions).toContain(
      'constraint "fk_auth_sessions_user_id_terminal_uuid" foreign key ("user_id", "terminal_uuid") references "auth_terminals" ("user_id", "terminal_uuid") on delete cascade',
    )
  })

  it('renders indexes with column order', () => {
    const sql = generateIndexSql(authTerminalsTable)
    expect(sql).toEqual([
      'create index if not exists "idx_auth_terminals_user_last_seen" on "auth_terminals" ("user_id", "last_seen_at" desc)',
    ])
  })

  it('renders defaults from TypeBox default values', () => {
    const packages = generateTableSql(
      serverTables.find(table => table.name === 'server_plugin_packages')!,
    )
    expect(packages).toContain('"enabled" integer default 1')
    expect(packages).toContain('"config_json" text default \'{}\'')
  })

  it('renders boolean columns with an in (0, 1) check', () => {
    const scripts = generateTableSql(
      serverTables.find(table => table.name === 'server_plugin_schedules')!,
    )
    expect(scripts).toContain('"enabled" integer default 0 not null check (enabled in (0, 1))')
  })

  it('renders enum columns with an in (...) check', () => {
    const runs = generateTableSql(serverTables.find(table => table.name === 'server_plugin_runs')!)
    expect(runs).toContain("check (trigger in ('manual', 'scheduled'))")
    expect(runs).toContain("check (status in ('running', 'succeeded', 'failed'))")
  })

  it('escapes quotes in enum checks', () => {
    const table = defineTable(
      'quotes',
      { value: Type.Union([Type.Literal("it's")]) },
      { primaryKey: ['value'] },
    )
    expect(generateTableSql(table)).toContain("check (value in ('it''s'))")
  })

  it('renders integer range checks as between', () => {
    const scripts = generateTableSql(
      serverTables.find(table => table.name === 'server_plugin_schedules')!,
    )
    expect(scripts).toContain(
      '"interval_hours" integer not null check (interval_hours between 1 and 168)',
    )
  })

  it('rejects unsupported column schemas', () => {
    expect(() =>
      generateTableSql(
        defineTable('bad', { value: { type: 'unknown' } as never }, { primaryKey: ['value'] }),
      ),
    ).toThrow(/Unsupported column schema/)
  })

  it('renders json columns as text', () => {
    const table = defineTable(
      'sync_entities',
      { user_id: Type.String(), data_json: jsonColumn('SyncEntityData') },
      { primaryKey: ['user_id'] },
    )
    expect(generateTableSql(table)).toContain('"data_json" text')
  })

  it('renders autoincrement primary key columns', () => {
    const table = defineTable(
      'sync_changes',
      { server_seq: autoIncrement() },
      { primaryKey: ['server_seq'] },
    )
    expect(generateTableSql(table)).toContain('"server_seq" integer primary key autoincrement')
  })

  it('renders unique indexes', () => {
    const table = defineTable(
      'sync_changes',
      { user_id: Type.String(), origin_terminal_uuid: Type.String(), origin_op_id: Type.String() },
      {
        indexes: [
          {
            name: 'idx_sync_changes_origin_op',
            columns: ['user_id', 'origin_terminal_uuid', 'origin_op_id'],
            unique: true,
          },
        ],
      },
    )
    expect(generateIndexSql(table)).toEqual([
      'create unique index if not exists "idx_sync_changes_origin_op" on "sync_changes" ("user_id", "origin_terminal_uuid", "origin_op_id")',
    ])
  })
})