import { describe, expect, it } from 'vitest'

import { applyServerSqlMigrations } from '../../lib/serverMigrations'

interface MigrationRow {
  migration_id: string
}

const createDatabase = () => {
  const applied = new Set<string>()
  const executed: string[] = []
  const database = {
    async exec(sql: string) {
      executed.push(sql)
      return { count: 0, duration: 0, meta: {} }
    },
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async all<T extends MigrationRow>() {
              if (sql.startsWith('SELECT migration_id')) {
                return { results: [...applied].map(migration_id => ({ migration_id })) as T[] }
              }
              return { results: [] as T[] }
            },
            async run() {
              if (sql.startsWith('INSERT INTO')) applied.add(String(values[2]))
              return { count: 1, duration: 0, meta: {} }
            },
          }
        },
      }
    },
  } as unknown as D1Database
  return { database, executed }
}

const manifest = {
  protocolVersion: 1 as const,
  id: 'demo',
  name: 'Demo',
  version: '1.0.0',
  entry: './index.js',
  entryType: 'plugin' as const,
  resources: [],
  routes: [],
  crons: [],
  queues: [],
  migrations: ['001-init', '002-index'],
  migrationResources: [
    { id: '001-init', path: 'migrations/001-init.sql' },
    { id: '002-index', path: 'migrations/002-index.sql' },
  ],
}

describe('server SQL migrations', () => {
  it('applies each installation migration once and skips recorded entries', async () => {
    const { database, executed } = createDatabase()
    const files = [
      { path: 'migrations/001-init.sql', content: 'CREATE TABLE demo (id TEXT)' },
      { path: 'migrations/002-index.sql', content: 'CREATE INDEX demo_id ON demo (id)' },
    ]

    await expect(
      applyServerSqlMigrations(database, 'demo', 'installation-1', manifest, files),
    ).resolves.toEqual({ applied: ['001-init', '002-index'], skipped: [] })
    await expect(
      applyServerSqlMigrations(database, 'demo', 'installation-1', manifest, files),
    ).resolves.toEqual({ applied: [], skipped: ['001-init', '002-index'] })
    expect(executed).toContain('CREATE TABLE demo (id TEXT)')
    expect(executed).toContain('CREATE INDEX demo_id ON demo (id)')
  })

  it('rejects a manifest whose SQL resource declaration is incomplete', async () => {
    const { database } = createDatabase()
    await expect(
      applyServerSqlMigrations(
        database,
        'demo',
        'installation-1',
        { ...manifest, migrationResources: [manifest.migrationResources[0]] },
        [],
      ),
    ).rejects.toThrow('SQL migration resource mismatch')
  })
})