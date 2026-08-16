import { describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({ warns: [] as unknown[], errors: [] as unknown[] }))

vi.mock('@delta-comic/logger', () => ({
  logger: {
    scoped: () => ({
      warn: (...args: unknown[]) => mocks.warns.push(args),
      error: (...args: unknown[]) => mocks.errors.push(args),
    }),
  },
}))

import {
  assertWrite,
  assertWriteRow,
  filterValidRows,
  filterValidRowsFor,
  tableSchema,
  validateRead,
  validateReadRow,
  type ClientTableName,
} from '../../lib/validation'

const validCard = { createAt: 1, description: 'desc', private: true, title: 'Reading' }

describe('assertWrite', () => {
  it('passes through valid rows', () => {
    expect(assertWrite(tableSchema('favouriteCard'), 'favouriteCard', validCard)).toEqual(validCard)
    expect(mocks.errors).toHaveLength(0)
  })

  it('accepts legacy boolean encodings', () => {
    expect(
      assertWrite(tableSchema('favouriteCard'), 'favouriteCard', { ...validCard, private: 0 }),
    ).toEqual({ ...validCard, private: 0 })
    expect(
      assertWrite(tableSchema('plugin'), 'plugin', {
        displayName: null,
        enable: 1,
        installInput: '',
        installerName: 'x',
        loaderName: 'y',
        meta: '{"name":"p"}',
        pluginName: 'p',
      }),
    ).toBeDefined()
  })

  it('throws on invalid rows', () => {
    expect(() =>
      assertWrite(tableSchema('favouriteCard'), 'favouriteCard', { ...validCard, title: 42 }),
    ).toThrow(/database write validation failed for favouriteCard/)
    expect(() =>
      assertWrite(tableSchema('favouriteCard'), 'favouriteCard', {
        ...validCard,
        unknownField: 'x',
      }),
    ).toThrow(/database write validation failed for favouriteCard/)
  })

  it('logs the failure details before throwing', () => {
    expect(() =>
      assertWrite(tableSchema('favouriteCard'), 'favouriteCard', { ...validCard, title: 42 }),
    ).toThrow()
    expect(mocks.errors.at(-1)).toEqual([
      'database write validation failed',
      expect.objectContaining({ table: 'favouriteCard' }),
    ])
  })
})

describe('assertWriteRow', () => {
  it('resolves the schema by typed table name', () => {
    expect(assertWriteRow('favouriteCard', validCard)).toEqual(validCard)
    expect(() => assertWriteRow('history', { timestamp: 'not-a-number' })).toThrow()
  })
})

describe('validateRead', () => {
  it('returns the value unchanged even when invalid', () => {
    const bad = { ...validCard, title: 42 }
    expect(validateRead(tableSchema('favouriteCard'), 'favouriteCard', bad)).toBe(bad)
    expect(mocks.warns.at(-1)).toEqual([
      'database read validation failed',
      expect.objectContaining({ table: 'favouriteCard' }),
    ])
  })
})

describe('validateReadRow', () => {
  it('is non-intrusive for typed tables', () => {
    const bad = { ...validCard, description: 7 }
    expect(validateReadRow('favouriteCard', bad)).toBe(bad)
  })
})

describe('filterValidRows', () => {
  it('drops invalid rows and keeps valid ones', () => {
    const valid = { ...validCard, createAt: 2 }
    const result = filterValidRows(tableSchema('favouriteCard'), 'favouriteCard', [
      validCard,
      valid,
    ])
    expect(result).toEqual([validCard, valid])
  })

  it('logs a warning for each dropped row', () => {
    filterValidRows(tableSchema('favouriteCard'), 'favouriteCard', [{ ...validCard, title: 1 }])
    expect(mocks.warns.at(-1)).toEqual([
      'database read validation failed, row dropped',
      expect.objectContaining({ table: 'favouriteCard' }),
    ])
  })
})

describe('filterValidRowsFor', () => {
  it('filters by typed table name', () => {
    expect(
      filterValidRowsFor('itemStore', [
        { item: { id: '1' }, key: 'k' },
        { item: 5, key: 'k' },
      ]),
    ).toEqual([{ item: { id: '1' }, key: 'k' }])
  })
})

describe('table schemas', () => {
  it('covers every client table with camelCase names', () => {
    const names: ClientTableName[] = [
      'itemStore',
      'favouriteCard',
      'favouriteItem',
      'history',
      'recentView',
      'subscribe',
      'plugin',
      'nativeStore',
      'config',
    ]
    for (const name of names) expect(tableSchema(name)).toBeDefined()
  })
})