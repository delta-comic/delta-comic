import { Type } from 'typebox'
import { describe, expect, expectTypeOf, it } from 'vitest'

import {
  camelCase,
  defineTable,
  generateCamelCaseRuntimeTableSchema,
  jsonColumn,
  type TableRow,
  validateTableSchema,
} from '../../codegen/schema.mts'

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

describe('camelCase runtime schema generation', () => {
  const camelTable = defineTable(
    'favourite_card',
    {
      create_at: Type.Integer(),
      title: Type.String(),
      private: Type.Boolean(),
      display_name: Type.Optional(Type.String()),
    },
    { primaryKey: ['create_at'] },
    { kyselyCamelCase: true, kyselyBoolean: true },
  )

  it('camelCases column keys and keeps boolean/optional value semantics', () => {
    expect(generateCamelCaseRuntimeTableSchema(camelTable)).toEqual({
      type: 'object',
      properties: {
        createAt: { type: 'integer' },
        title: { type: 'string' },
        private: { anyOf: [{ type: 'boolean' }, { const: 0 }, { const: 1 }] },
        displayName: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      },
      required: ['createAt', 'title', 'private', 'displayName'],
      additionalProperties: false,
    })
  })

  it('accepts JSON columns as object or string', () => {
    const table = defineTable(
      'item_store',
      { key: Type.String(), item: jsonColumn() },
      { primaryKey: ['key'] },
      { kyselyCamelCase: true },
    )
    expect(generateCamelCaseRuntimeTableSchema(table).properties.item).toEqual({
      anyOf: [{ type: 'object' }, { type: 'string' }],
    })
  })

  it('leaves non-camelCase tables untouched', () => {
    expect(generateCamelCaseRuntimeTableSchema(authUsersTable)).toEqual({
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        login_name: { type: 'string' },
        created_at: { type: 'integer' },
        disabled_at: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
      },
      required: ['id', 'login_name', 'created_at', 'disabled_at'],
      additionalProperties: false,
    })
  })
})

describe('camelCase helper', () => {
  it('converts snake_case to camelCase', () => {
    expect(camelCase('favourite_card')).toBe('favouriteCard')
    expect(camelCase('item_key')).toBe('itemKey')
  })
})