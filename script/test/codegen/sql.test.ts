import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { Type } from '@sinclair/typebox'
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

const tables: readonly TableSchema[] = [authUsersTable, authTerminalsTable, authSessionsTable]

const generatedSql = (table: TableSchema): string =>
  [generateTableSql(table), ...generateIndexSql(table)].join(';\n')

const runMigration = (db: DatabaseSync): void => {
  const migration = readFileSync(join(rootDir, 'packages/server/migrations/0001_auth.sql'), 'utf8')
  db.exec(migration)
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

  it('rejects unsupported column schemas', () => {
    expect(() =>
      generateTableSql(
        defineTable('bad', { value: { type: 'unknown' } as never }, { primaryKey: ['value'] }),
      ),
    ).toThrow(/Unsupported column schema/)
  })
})