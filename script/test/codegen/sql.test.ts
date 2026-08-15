import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { Type } from 'typebox'
import { describe, expect, it } from 'vitest'

import { defineTable, type TableSchema } from '../../codegen/schema.mts'
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
    action: Type.Union([
      Type.Literal('configure'),
      Type.Literal('disable'),
      Type.Literal('enable'),
      Type.Literal('health'),
      Type.Literal('install'),
      Type.Literal('register'),
      Type.Literal('uninstall'),
      Type.Literal('update'),
    ]),
    status: Type.Union([
      Type.Literal('failed'),
      Type.Literal('queued'),
      Type.Literal('running'),
      Type.Literal('succeeded'),
    ]),
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
    action: Type.String(),
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

const tables: readonly TableSchema[] = [
  authUsersTable,
  authTerminalsTable,
  authSessionsTable,
  pluginRegistryTable,
  pluginInstallationsTable,
  pluginJobsTable,
  pluginAuditTable,
  pluginScriptsTable,
  pluginScriptRunsTable,
]

const generatedSql = (table: TableSchema): string =>
  [generateTableSql(table), ...generateIndexSql(table)].join(';\n')

const runMigration = (db: DatabaseSync): void => {
  for (const name of [
    '0001_auth.sql',
    '0003_server_plugins.sql',
    '0004_server_plugin_scripts.sql',
  ]) {
    db.exec(readFileSync(join(rootDir, 'packages/server/migrations', name), 'utf8'))
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
    const registry = generateTableSql(pluginRegistryTable)
    const installations = generateTableSql(pluginInstallationsTable)
    expect(registry).toContain('"trusted" integer default 1')
    expect(installations).toContain('"config_json" text default \'{}\'')
  })

  it('renders boolean columns with an in (0, 1) check', () => {
    const scripts = generateTableSql(pluginScriptsTable)
    expect(scripts).toContain('"enabled" integer default 0 not null check (enabled in (0, 1))')
  })

  it('renders enum columns with an in (...) check', () => {
    const installations = generateTableSql(pluginInstallationsTable)
    const jobs = generateTableSql(pluginJobsTable)
    expect(installations).toContain("check (desired_state in ('disabled', 'enabled'))")
    expect(jobs).toContain(
      "check (action in ('configure', 'disable', 'enable', 'health', 'install', 'register', 'uninstall', 'update'))",
    )
  })

  it('renders integer range checks as between', () => {
    const scripts = generateTableSql(pluginScriptsTable)
    expect(scripts).toContain(
      '"interval_hours" integer default 1 not null check (interval_hours between 1 and 168)',
    )
  })

  it('rejects unsupported column schemas', () => {
    expect(() =>
      generateTableSql(
        defineTable('bad', { value: { type: 'unknown' } as never }, { primaryKey: ['value'] }),
      ),
    ).toThrow(/Unsupported column schema/)
  })
})