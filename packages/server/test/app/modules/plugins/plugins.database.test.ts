import { describe, expect, it, vi } from 'vitest'

import type { AppEnv } from '@/env'

import { PluginDatabase } from '../../../../app/modules/plugins/plugins.database'

describe('PluginDatabase', () => {
  it('forwards prepared, batch, and unrestricted SQL operations to D1', async () => {
    const statement = {
      all: vi.fn(async () => ({ results: ['all'] })),
      bind: vi.fn(),
      first: vi.fn(async () => 'first'),
      raw: vi.fn(async () => [['raw']]),
      run: vi.fn(async () => ({ results: ['run'] })),
    }
    statement.bind.mockReturnValue(statement)
    const db = {
      batch: vi.fn(async values => values),
      dump: vi.fn(async () => new ArrayBuffer(0)),
      exec: vi.fn(async () => ({ count: 1, duration: 0 })),
      prepare: vi.fn(() => statement),
    } as unknown as D1Database
    const binding = new PluginDatabase({} as ExecutionContext, { DB: db } as AppEnv)

    await binding.all('SELECT ?', [1])
    await binding.first('SELECT name', [], 'name')
    await binding.run('UPDATE example SET value = ?', ['updated'])
    await binding.raw('SELECT value', [], { columnNames: true })
    await binding.batch([
      { query: 'INSERT INTO example VALUES (?)', values: [1] },
      { query: 'DELETE FROM example', values: [] },
    ])
    await binding.exec('CREATE TABLE arbitrary (id INTEGER)')
    await binding.dump()

    expect(db.prepare).toHaveBeenCalledWith('SELECT ?')
    expect(statement.bind).toHaveBeenCalledWith(1)
    expect(statement.first).toHaveBeenCalledWith('name')
    expect(statement.raw).toHaveBeenCalledWith({ columnNames: true })
    expect(db.batch).toHaveBeenCalledOnce()
    expect(db.exec).toHaveBeenCalledWith('CREATE TABLE arbitrary (id INTEGER)')
    expect(db.dump).toHaveBeenCalledOnce()
  })
})