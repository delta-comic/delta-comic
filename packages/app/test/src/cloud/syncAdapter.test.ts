import { syncCollectionNames, type SyncChange } from '@delta-comic/server'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

interface DbAction {
  collection: string
  data?: unknown
  kind: 'delete' | 'replace'
  where?: [column: string, operator: string, value: unknown][]
}

const { actions, snapshotRows, withTransition } = vi.hoisted(() => ({
  actions: [] as DbAction[],
  snapshotRows: new Map<string, unknown[]>(),
  withTransition: vi.fn(),
}))

const makeDelete = (collection: string) => {
  const where: [string, string, unknown][] = []
  const builder = {
    where(column: string, operator: string, value: unknown) {
      where.push([column, operator, value])
      return builder
    },
    async execute() {
      actions.push({ collection, kind: 'delete', where: [...where] })
    },
  }
  return builder
}

const trx = {
  deleteFrom: vi.fn((collection: string) => makeDelete(collection)),
  replaceInto: vi.fn((collection: string) => ({
    values: (data: unknown) => ({
      async execute() {
        actions.push({ collection, data, kind: 'replace' })
      },
    }),
  })),
}

vi.mock('@delta-comic/db', () => ({
  DBUtils: { withTransition },
  db: {
    selectFrom: vi.fn((collection: string) => ({
      selectAll: vi.fn(() => ({ execute: vi.fn(async () => snapshotRows.get(collection) ?? []) })),
    })),
  },
}))

import { DbCloudSyncAdapter } from '../../../src/cloud/syncAdapter'

const change = (
  collection: SyncChange['collection'],
  action: SyncChange['action'],
  serverSeq: number,
  entityId: string,
  data?: unknown,
) => ({ action, collection, data, entityId, serverSeq }) as SyncChange

describe('DbCloudSyncAdapter', () => {
  beforeEach(() => {
    actions.length = 0
    snapshotRows.clear()
    trx.deleteFrom.mockClear()
    trx.replaceInto.mockClear()
    withTransition.mockReset()
    withTransition.mockImplementation(async (handler: (transaction: typeof trx) => unknown) =>
      handler(trx),
    )
  })

  it('collects every supported sync collection into one stable snapshot', async () => {
    for (const [index, collection] of syncCollectionNames.entries()) {
      snapshotRows.set(collection, [{ collection, index }])
    }

    const snapshot = await new DbCloudSyncAdapter().collectSnapshot()

    expect(Object.keys(snapshot)).toEqual(syncCollectionNames)
    for (const [index, collection] of syncCollectionNames.entries()) {
      expect(snapshot[collection]).toEqual([{ collection, index }])
    }
  })

  it('orders parent writes before dependent records and child deletes before parents', async () => {
    const changes = [
      change('itemStore', 'delete', 10, 'item-1'),
      change('favouriteItem', 'upsert', 7, '1:item-1', { itemKey: 'item-1' }),
      change('favouriteCard', 'delete', 8, '1'),
      change('config', 'upsert', 5, 'app', { belongTo: 'app' }),
      change('itemStore', 'upsert', 9, 'item-1', { key: 'item-1' }),
      change('favouriteItem', 'delete', 6, '1:item-1'),
      change('favouriteCard', 'upsert', 4, '1', { createAt: 1 }),
    ]

    await new DbCloudSyncAdapter().applyRemoteChanges(changes)

    expect(actions.map(action => `${action.kind}:${action.collection}`)).toEqual([
      'replace:itemStore',
      'replace:favouriteCard',
      'replace:favouriteItem',
      'replace:config',
      'delete:favouriteItem',
      'delete:favouriteCard',
      'delete:itemStore',
    ])
    expect(withTransition).toHaveBeenCalledOnce()
  })

  it('uses server sequence as the deterministic order within the same dependency tier', async () => {
    await new DbCloudSyncAdapter().applyRemoteChanges([
      change('subscribe', 'upsert', 9, 'plugin:b', { key: 'b' }),
      change('recentView', 'upsert', 2, 'item-1', { itemKey: 'item-1' }),
      change('history', 'upsert', 1, 'item-1', { itemKey: 'item-1' }),
      change('subscribe', 'upsert', 3, 'plugin:a', { key: 'a' }),
    ])

    expect(actions.map(action => action.data)).toEqual([
      { itemKey: 'item-1' },
      { itemKey: 'item-1' },
      { key: 'a' },
      { key: 'b' },
    ])
  })

  it('skips malformed writes without data while applying the remaining batch', async () => {
    await new DbCloudSyncAdapter().applyRemoteChanges([
      change('itemStore', 'upsert', 1, 'missing'),
      change('config', 'upsert', 2, 'app', { belongTo: 'app' }),
    ])

    expect(actions).toEqual([{ collection: 'config', data: { belongTo: 'app' }, kind: 'replace' }])
  })

  it.each([
    ['itemStore', 'item-key', [['key', '=', 'item-key']]],
    ['favouriteCard', '42', [['createAt', '=', 42]]],
    [
      'favouriteItem',
      '42:item:key:with:colons',
      [
        ['belongTo', '=', 42],
        ['itemKey', '=', 'item:key:with:colons'],
      ],
    ],
    ['history', 'item-key', [['itemKey', '=', 'item-key']]],
    ['recentView', 'item-key', [['itemKey', '=', 'item-key']]],
    [
      'subscribe',
      'plugin:key:with:colons',
      [
        ['plugin', '=', 'plugin'],
        ['key', '=', 'key:with:colons'],
      ],
    ],
    ['config', 'app', [['belongTo', '=', 'app']]],
  ] as const)(
    'maps a %s tombstone entity id to its concrete database key',
    async (collection, entityId, where) => {
      await new DbCloudSyncAdapter().applyRemoteChanges([change(collection, 'delete', 1, entityId)])

      expect(actions).toEqual([{ collection, kind: 'delete', where }])
    },
  )
})