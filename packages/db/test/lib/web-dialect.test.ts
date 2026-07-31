import { describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  dialectOptions: undefined as any,
  raw: vi.fn((sql: string) => ({ sql })),
}))

vi.mock('kysely', () => ({ CompiledQuery: { raw: mocks.raw } }))
vi.mock('kysely-wasqlite-worker', () => ({
  WaSqliteWorkerDialect: class {
    constructor(options: unknown) {
      mocks.dialectOptions = options
    }
  },
}))

import { createWebDialect, WEB_SCHEMA_STATEMENTS } from '../../lib/web'

describe('web database dialect', () => {
  it('enables foreign keys and applies the complete schema to new connections', async () => {
    const dialect = createWebDialect()
    const executeQuery = vi.fn(async () => undefined)

    await mocks.dialectOptions.onCreateConnection({ executeQuery })

    expect(dialect).toBeDefined()
    expect(mocks.dialectOptions).toMatchObject({ fileName: 'delta-comic.db', preferOPFS: true })
    expect(mocks.raw).toHaveBeenNthCalledWith(1, 'PRAGMA foreign_keys = ON')
    expect(mocks.raw).toHaveBeenCalledTimes(WEB_SCHEMA_STATEMENTS.length + 1)
    expect(executeQuery).toHaveBeenCalledTimes(WEB_SCHEMA_STATEMENTS.length + 1)
    expect(executeQuery).toHaveBeenLastCalledWith({ sql: WEB_SCHEMA_STATEMENTS.at(-1) })
  })
})