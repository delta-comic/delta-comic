import { Type } from 'typebox'
import { describe, expect, it } from 'vitest'

import { generateTableInterface } from '../../codegen/kysely.mts'
import { defineTable, jsonColumn } from '../../codegen/schema.mts'

const authUsersTable = defineTable(
  'auth_users',
  {
    id: Type.String({ format: 'uuid' }),
    login_name: Type.String(),
    created_at: Type.Integer(),
    enabled: Type.Boolean(),
    disabled_at: Type.Optional(Type.Integer()),
  },
  { primaryKey: ['id'] },
)

describe('kysely codegen', () => {
  it('generates a PascalCase interface with the Table suffix', () => {
    const source = generateTableInterface(authUsersTable)
    expect(source.startsWith('export interface AuthUsersTable {')).toBe(true)
  })

  it('maps scalar types', () => {
    const source = generateTableInterface(authUsersTable)
    expect(source).toContain('  id: string')
    expect(source).toContain('  login_name: string')
    expect(source).toContain('  created_at: number')
  })

  it('maps booleans to SQLite integer values', () => {
    const source = generateTableInterface(authUsersTable)
    expect(source).toContain('  enabled: number')
  })

  it('maps optional columns to null unions', () => {
    const source = generateTableInterface(authUsersTable)
    expect(source).toContain('  disabled_at: number | null')
  })

  it('rejects JSON columns until jsonColumn is implemented', () => {
    const table = defineTable('meta_table', { data: Type.Object({ v: Type.Number() }) }, {})
    expect(() => generateTableInterface(table)).toThrow(/JSON column types/)
  })

  it('exports Selectable, Insertable and Updateable helper types', () => {
    const source = generateTableInterface(authUsersTable)
    expect(source).toContain('export type AuthUser = Selectable<AuthUsersTable>')
    expect(source).toContain('export type NewAuthUser = Insertable<AuthUsersTable>')
    expect(source).toContain('export type AuthUserUpdate = Updateable<AuthUsersTable>')
  })

  it('singularizes plural names ending in ies', () => {
    const table = defineTable('sync_entities', { id: Type.String() }, { primaryKey: ['id'] })
    expect(generateTableInterface(table)).toContain(
      'export type SyncEntity = Selectable<SyncEntitiesTable>',
    )
  })

  it('converts snake case columns for CamelCasePlugin databases', () => {
    const table = defineTable(
      'recent_view',
      { item_key: Type.String(), is_viewed: Type.Boolean() },
      { primaryKey: ['item_key'] },
      { kyselyCamelCase: true },
    )
    expect(generateTableInterface(table)).toContain('  itemKey: string')
    expect(generateTableInterface(table)).toContain('  isViewed: number')
  })

  it('maps JSON columns to the declared imported model type', () => {
    const table = defineTable(
      'item_store',
      { item: jsonColumn('UniItemRaw', '@delta-comic/model') },
      { primaryKey: ['item'] },
    )
    expect(generateTableInterface(table)).toContain('  item: JSONColumnType<UniItemRaw>')
  })
})