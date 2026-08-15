import { Type } from 'typebox'
import { describe, expect, expectTypeOf, it } from 'vitest'

import { defineTable, type TableRow, validateTableSchema } from '../../codegen/schema.mts'

const authUsersTable = defineTable(
  'auth_users',
  {
    id: Type.String({ format: 'uuid' }),
    login_name: Type.String(),
    created_at: Type.Integer(),
    disabled_at: Type.Optional(Type.Integer()),
  },
  { primaryKey: ['id'] },
)

describe('defineTable', () => {
  it('preserves the table name and column order', () => {
    expect(authUsersTable.name).toBe('auth_users')
    expect(Object.keys(authUsersTable.columns)).toEqual([
      'id',
      'login_name',
      'created_at',
      'disabled_at',
    ])
  })

  it('carries table metadata', () => {
    expect(authUsersTable.meta.primaryKey).toEqual(['id'])
  })
})

describe('TableRow type derivation', () => {
  it('maps required columns to their static types', () => {
    expectTypeOf<TableRow<typeof authUsersTable>>().toEqualTypeOf<{
      id: string
      login_name: string
      created_at: number
      disabled_at: number | null
    }>()
  })

  it('maps optional columns to null unions', () => {
    const row: TableRow<typeof authUsersTable> = {
      id: 'uuid',
      login_name: 'name',
      created_at: 0,
      disabled_at: null,
    }
    expect(row.disabled_at).toBeNull()
  })
})

describe('table validation', () => {
  it('rejects metadata that references missing columns', () => {
    const table = defineTable('users', { id: Type.String() }, { primaryKey: ['missing'] as never })
    expect(() => validateTableSchema(table)).toThrow(
      'primaryKey references unknown column "missing"',
    )
  })

  it('rejects duplicate index names', () => {
    const table = defineTable(
      'users',
      { id: Type.String() },
      {
        primaryKey: ['id'],
        indexes: [
          { name: 'users_id', columns: ['id'] },
          { name: 'users_id', columns: ['id'] },
        ],
      },
    )
    expect(() => validateTableSchema(table)).toThrow('duplicate index name "users_id"')
  })
})