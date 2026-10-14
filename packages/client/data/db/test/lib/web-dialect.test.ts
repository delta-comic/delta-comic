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
    createWebDialect()
    const executeQuery = vi.fn(async () => ({ rows: [{ name: 'config' }] }))

    await mocks.dialectOptions.onCreateConnection({ executeQuery })

    expect(mocks.dialectOptions).toMatchObject({ fileName: 'delta-comic.db', preferOPFS: true })
    expect(mocks.raw).toHaveBeenNthCalledWith(1, 'PRAGMA foreign_keys = ON')
    expect(mocks.raw).toHaveBeenCalledTimes(WEB_SCHEMA_STATEMENTS.length + 2)
    expect(executeQuery).toHaveBeenCalledTimes(WEB_SCHEMA_STATEMENTS.length + 2)
    expect(executeQuery).toHaveBeenLastCalledWith({ sql: 'PRAGMA table_info(plugin)' })
  })

  it('adds the installation config column to an existing database', async () => {
    createWebDialect()
    const executeQuery = vi.fn(async () => ({ rows: [{ name: 'pluginName' }] }))
    await mocks.dialectOptions.onCreateConnection({ executeQuery })
    expect(executeQuery).toHaveBeenLastCalledWith({
      sql: 'ALTER TABLE plugin ADD COLUMN config JSON',
    })
  })
})