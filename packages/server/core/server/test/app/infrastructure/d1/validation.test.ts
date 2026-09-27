import { Type } from 'typebox'
import { describe, expect, it } from 'vitest'

import {
  assertDatabasePatch,
  assertDatabaseRead,
  assertDatabaseWrite,
} from '../../../../app/infrastructure/d1/validation'
import { AppError } from '../../../../app/shared/errors'

const rowSchema = Type.Object({
  id: Type.String(),
  enabled: Type.Integer(),
  note: Type.Union([Type.String(), Type.Null()]),
})

describe('database validation', () => {
  it('accepts valid rows and patches', () => {
    const row = { enabled: 1, id: 'row-1', note: null }
    expect(assertDatabaseRead(rowSchema, 'example', row)).toBe(row)
    expect(assertDatabaseWrite(rowSchema, 'example', row)).toBe(row)
    expect(assertDatabasePatch(rowSchema, 'example', { enabled: 0 })).toEqual({ enabled: 0 })
  })

  it('reports a stable AppError with bounded details for invalid values', () => {
    expect(() => assertDatabaseRead(rowSchema, 'example', { enabled: 'yes' })).toThrowError(
      AppError,
    )
    try {
      assertDatabaseRead(rowSchema, 'example', { enabled: 'yes' })
    } catch (error) {
      expect(error).toMatchObject({
        code: 'DATABASE_SCHEMA_INVALID',
        details: { operation: 'read', table: 'example' },
        status: 500,
      } satisfies Partial<AppError>)
    }
    expect(() => assertDatabaseWrite(rowSchema, 'example', { enabled: 'yes' })).toThrowError(
      expect.objectContaining({ code: 'DATABASE_SCHEMA_INVALID' }),
    )
  })
})