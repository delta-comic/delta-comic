import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { BuiltInPluginDefinition } from '../../../lib/plugin'

const databaseMocks = vi.hoisted(() => ({
  deleteWhere: vi.fn(),
  existing: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
}))

vi.mock('@delta-comic/db', () => {
  const transaction = {
    execute: async (run: (transaction: any) => Promise<void>) => {
      const trx = {
        deleteFrom: () => {
          const query = {
            execute: vi.fn(async () => undefined),
            where: vi.fn((...args: unknown[]) => {
              databaseMocks.deleteWhere(...args)
              return query
            }),
          }
          return query
        },
        insertInto: () => ({
          values: (values: Record<string, unknown>) => ({
            execute: async () => databaseMocks.inserts.push(values),
          }),
        }),
        selectFrom: () => ({ selectAll: () => ({ execute: async () => databaseMocks.existing }) }),
        updateTable: () => ({
          set: (values: Record<string, unknown>) => ({
            where: () => ({ execute: async () => databaseMocks.updates.push(values) }),
          }),
        }),
      }
      await run(trx)
    },
  }
  return { db: { transaction: () => transaction } }
})

import {
  BUILT_IN_PLUGIN_LOADER,
  builtInDefinitionToArchive,
  isBuiltInPlugin,
  isBuiltInPluginName,
  synchronizeBuiltInPlugins,
} from '../../../lib/driver/builtIn'

beforeEach(() => {
  vi.clearAllMocks()
  databaseMocks.existing = []
  databaseMocks.inserts = []
  databaseMocks.updates = []
})

const definition: BuiltInPluginDefinition = {
  meta: {
    author: 'Delta Comic',
    description: 'core',
    kind: 'preboot',
    name: { display: '核心', id: 'core' },
    require: [],
    version: { plugin: '1.0.0', supportCore: '*' },
  },
  config: () => ({ name: 'core' }),
}

describe('built-in plugin archive', () => {
  it('uses the dedicated loader and default enable state', () => {
    const archive = builtInDefinitionToArchive(definition)
    expect(archive).toMatchObject({
      enable: true,
      loaderName: BUILT_IN_PLUGIN_LOADER,
      pluginName: 'core',
    })
    expect(isBuiltInPlugin(archive)).toBe(true)
  })

  it('preserves an explicitly disabled state', () => {
    expect(builtInDefinitionToArchive(definition, false).enable).toBe(false)
    expect(builtInDefinitionToArchive({ ...definition, enabledByDefault: false }).enable).toBe(
      false,
    )
    expect(isBuiltInPlugin({ loaderName: 'zip' })).toBe(false)
    expect(isBuiltInPluginName('core')).toBe(true)
    expect(isBuiltInPluginName('missing')).toBe(false)
  })

  it('inserts missing compile-time plugins and removes stale built-in rows', async () => {
    await synchronizeBuiltInPlugins()

    expect(databaseMocks.inserts).toHaveLength(1)
    expect(databaseMocks.inserts[0]).toMatchObject({
      enable: true,
      loaderName: BUILT_IN_PLUGIN_LOADER,
      pluginName: 'core',
    })
    expect(JSON.parse(databaseMocks.inserts[0]?.meta as string)).toMatchObject({
      name: { id: 'core' },
    })
    expect(databaseMocks.deleteWhere).toHaveBeenCalledWith(
      'pluginName',
      'not in',
      expect.arrayContaining(['core']),
    )
  })

  it('updates an existing built-in plugin without re-enabling a user-disabled row', async () => {
    databaseMocks.existing = [
      { enable: false, loaderName: BUILT_IN_PLUGIN_LOADER, pluginName: 'core' },
    ]

    await synchronizeBuiltInPlugins()

    expect(databaseMocks.inserts).toEqual([])
    expect(databaseMocks.updates).toHaveLength(1)
    expect(databaseMocks.updates[0]).toMatchObject({ enable: false, pluginName: 'core' })
  })
})