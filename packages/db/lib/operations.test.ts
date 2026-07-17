import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  defaultTrx: undefined as any,
  invalidateQueries: vi.fn(async () => undefined),
  mutationOptions: [] as any[],
  queryOptions: [] as any[],
}))

vi.mock('@pinia/colada', () => ({
  defineMutation: (factory: () => unknown) => factory,
  useMutation: (options: any) => {
    mocks.mutationOptions.push(options)
    return { mutateAsync: options.mutation, settle: options.onSettled }
  },
  useQuery: (options: any) => {
    mocks.queryOptions.push(options)
    return options
  },
  useQueryCache: () => ({ invalidateQueries: mocks.invalidateQueries }),
}))
vi.mock('./utils', () => ({
  CommonQueryKey: { common: 'db' },
  withTransition: (handler: (trx: any) => unknown, trx?: any) => handler(trx ?? mocks.defaultTrx),
}))

import * as FavouriteDB from './favourite'
import * as HistoryDB from './history'
import * as ItemStoreDB from './itemStore'
import * as PluginDB from './plugin'
import * as RecentViewDB from './recentView'
import * as SubscribeDB from './subscribe'

const createTrx = () => {
  const calls = {
    deletes: [] as { table: string; where: unknown[][] }[],
    replaces: [] as { table: string; values: unknown }[],
    selects: [] as { table: string; where: unknown[][] }[],
    updates: [] as { set: unknown; table: string; where: unknown[][] }[],
  }
  const selected = new Map<string, unknown>()

  const query = (table: string, operation: 'delete' | 'replace' | 'select' | 'update') => {
    const where: unknown[][] = []
    let values: unknown
    let set: unknown
    const builder: any = {
      execute: vi.fn(async () => {
        if (operation === 'delete') calls.deletes.push({ table, where })
        if (operation === 'replace') calls.replaces.push({ table, values })
        if (operation === 'update') calls.updates.push({ set, table, where })
        return []
      }),
      executeTakeFirstOrThrow: vi.fn(async () => {
        calls.selects.push({ table, where })
        const result = selected.get(table)
        if (!result) throw new Error(`missing selected fixture for ${table}`)
        return result
      }),
      select: vi.fn(() => builder),
      set: vi.fn((next: unknown) => {
        set = next
        return builder
      }),
      values: vi.fn((next: unknown) => {
        values = next
        return builder
      }),
      where: vi.fn((...args: unknown[]) => {
        where.push(args)
        return builder
      }),
    }
    return builder
  }

  return {
    calls,
    deleteFrom: (table: string) => query(table, 'delete'),
    replaceInto: (table: string) => query(table, 'replace'),
    selectFrom: (table: string) => query(table, 'select'),
    selected,
    updateTable: (table: string) => query(table, 'update'),
  }
}

const item = {
  $$plugin: 'fixture',
  author: [],
  categories: [],
  commentSendable: false,
  contentType: ['fixture', 'manga'],
  cover: { $$plugin: 'fixture', pathname: 'cover.jpg', type: 'image' },
  epLength: '1',
  id: 'item-1',
  length: '1',
  thisEp: { $$plugin: 'fixture', id: 'ep-1', name: 'Episode 1' },
  title: 'Fixture',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.mutationOptions.splice(0)
  mocks.queryOptions.splice(0)
  mocks.defaultTrx = createTrx()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-14T08:00:00Z'))
})

describe('item and favourite mutations', () => {
  it('stores the item once and links it to every requested favourite card', async () => {
    const trx = createTrx()
    const mutation = FavouriteDB.useUpsertItem()

    await mutation.upsert({ belongTos: [10, 20], item: item as never, trx: trx as never })
    mocks.mutationOptions.at(-1).onSettled()

    expect(trx.calls.replaces).toEqual([
      { table: 'itemStore', values: { item, key: 'fixture:manga*item-1' } },
      {
        table: 'favouriteItem',
        values: [
          {
            addTime: Date.parse('2026-07-14T08:00:00Z'),
            belongTo: 10,
            itemKey: 'fixture:manga*item-1',
          },
          {
            addTime: Date.parse('2026-07-14T08:00:00Z'),
            belongTo: 20,
            itemKey: 'fixture:manga*item-1',
          },
        ],
      },
    ])
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ key: mutation.key })
  })

  it('moves an item by deleting its source relation before inserting targets', async () => {
    const trx = createTrx()
    const mutation = FavouriteDB.useMoveItem()

    await mutation.move({ aims: [2, 3], from: 1, item: item as never, trx: trx as never })

    expect(trx.calls.deletes).toEqual([
      {
        table: 'favouriteItem',
        where: [
          ['itemKey', '=', 'item-1'],
          ['belongTo', '=', 1],
        ],
      },
    ])
    expect(trx.calls.replaces[0]).toMatchObject({
      table: 'favouriteItem',
      values: [
        expect.objectContaining({ belongTo: 2, itemKey: 'item-1' }),
        expect.objectContaining({ belongTo: 3, itemKey: 'item-1' }),
      ],
    })
  })

  it('creates favourite cards and exposes stable query keys', async () => {
    const trx = createTrx()
    const card = { createAt: 1, description: 'desc', private: false, title: 'Reading' }
    await FavouriteDB.useCreateCard().createCard({ card, trx: trx as never })
    const query = vi.fn(async () => ['result'])
    const itemQuery = FavouriteDB.useQueryItem(query as never, ['scope'], () => []) as any
    const cardQuery = FavouriteDB.useQueryCard(query as never, ['scope'], () => []) as any

    expect(trx.calls.replaces).toEqual([{ table: 'favouriteCard', values: card }])
    expect(itemQuery.key()).toEqual([
      FavouriteDB.QueryKey.item,
      FavouriteDB.QueryKey.card,
      query,
      'scope',
    ])
    expect(cardQuery.key()).toEqual([FavouriteDB.QueryKey.card, query, 'scope'])
    expect(cardQuery.refetchOnMount).toBe('always')
  })

  it('returns the deterministic item key from the standalone item upsert', async () => {
    const trx = createTrx()

    await expect(
      ItemStoreDB.useUpsert().upsert({ item: item as never, trx: trx as never }),
    ).resolves.toBe('fixture:manga*item-1')
  })
})

describe('history and recent-view mutations', () => {
  it('inserts or updates history with a timestamp and removes requested history keys', async () => {
    const trx = createTrx()
    await HistoryDB.useUpsert().upsert({ item: item as never, trx: trx as never })
    await HistoryDB.useRemove().remove({ keys: [10, 20], trx: trx as never })

    expect(trx.calls.replaces.at(-1)).toEqual({
      table: 'history',
      values: {
        ep: item,
        itemKey: 'fixture:manga*item-1',
        timestamp: Date.parse('2026-07-14T08:00:00Z'),
      },
    })
    expect(trx.calls.deletes.at(-1)).toEqual({
      table: 'history',
      where: [['history.timestamp', 'is', [10, 20]]],
    })
    const query = HistoryDB.useQuery(vi.fn() as never, ['reader']) as any
    expect(query.key()).toContain(HistoryDB.QueryKey.item)
  })

  it('marks recent items unseen and removes requested timestamps', async () => {
    const trx = createTrx()
    await RecentViewDB.useUpsert().upsert({ item: item as never, trx: trx as never })
    await RecentViewDB.useRemove().remove({ items: [30], trx: trx as never })

    expect(trx.calls.replaces.at(-1)).toEqual({
      table: 'recentView',
      values: {
        isViewed: false,
        itemKey: 'fixture:manga*item-1',
        timestamp: Date.parse('2026-07-14T08:00:00Z'),
      },
    })
    expect(trx.calls.deletes.at(-1)).toEqual({
      table: 'recentView',
      where: [['recentView.timestamp', 'is', [30]]],
    })
    expect((RecentViewDB.useQuery(vi.fn() as never) as any).refetchOnMount).toBe('always')
  })
})

describe('subscription mutations', () => {
  it('serializes author payloads on upsert and deletes by sourced keys', async () => {
    const trx = createTrx()
    const author = { $$plugin: 'fixture', description: 'author', icon: 'avatar', label: 'A' }
    const subscriptions = [
      { author, itemKey: null, key: 'fixture:A', plugin: 'fixture', type: 'author' as const },
      {
        author: null,
        itemKey: 'item-1',
        key: 'fixture:item-1',
        plugin: 'fixture',
        type: 'ep' as const,
      },
    ]

    await SubscribeDB.useUpsert().upsert({ items: subscriptions, trx: trx as never })
    await SubscribeDB.useRemove().remove({ keys: ['fixture:A'], trx: trx as never })

    expect(trx.calls.replaces[0]).toEqual({
      table: 'subscribe',
      values: [
        { ...subscriptions[0], author: JSON.stringify(author) },
        { ...subscriptions[1], author: JSON.stringify(null) },
      ],
    })
    expect(trx.calls.deletes[0]).toEqual({
      table: 'subscribe',
      where: [['subscribe.key', 'is', ['fixture:A']]],
    })
    expect(SubscribeDB.key.toJSON('fixture:A')).toEqual(['fixture', 'A'])
    expect((SubscribeDB.useQuery(vi.fn() as never) as any).staleTime).toBe(15_000)
  })
})

describe('plugin archive mutations', () => {
  const pluginArchive = {
    displayName: 'Fixture',
    enable: true,
    installInput: '',
    installerName: '',
    loaderName: 'zip',
    meta: {
      author: 'test',
      description: 'test',
      icon: 'assets/icon.png',
      name: { display: 'Fixture', id: 'fixture' },
      require: [],
      version: { plugin: '1.0.0', supportCore: '*' },
    },
    pluginName: 'fixture',
  }

  it('skips empty removals and deletes non-empty name batches', async () => {
    const trx = createTrx()

    await PluginDB.removeByNames([], trx as never)
    await PluginDB.removeByNames(['fixture'], trx as never)

    expect(trx.calls.deletes).toEqual([
      { table: 'plugin', where: [['plugin.pluginName', 'in', ['fixture']]] },
    ])
  })

  it('serializes plugin metadata on upsert and delegates removal', async () => {
    const trx = createTrx()

    await PluginDB.useUpsert().upsert({ archives: [pluginArchive] as never, trx: trx as never })
    await PluginDB.useRemove().remove({ keys: ['fixture'], trx: trx as never })

    expect(trx.calls.replaces[0]).toEqual({
      table: 'plugin',
      values: [{ ...pluginArchive, meta: JSON.stringify(pluginArchive.meta) }],
    })
    expect(trx.calls.deletes[0].table).toBe('plugin')
  })

  it('toggles the persisted enable flag', async () => {
    const trx = createTrx()
    trx.selected.set('plugin', { enable: true })

    await PluginDB.useToggleEnable().toggle({ keys: ['fixture'], trx: trx as never })

    expect(trx.calls.selects).toEqual([
      { table: 'plugin', where: [['pluginName', '=', 'fixture']] },
    ])
    expect(trx.calls.updates).toEqual([
      { set: { enable: false }, table: 'plugin', where: [['pluginName', '=', 'fixture']] },
    ])
  })

  it('changes normal plugin kind while protecting built-in archives', async () => {
    const builtinTrx = createTrx()
    builtinTrx.selected.set('plugin', { loaderName: 'builtin', meta: pluginArchive.meta })
    mocks.defaultTrx = builtinTrx
    await expect(
      PluginDB.useSetKind().setKind({ kind: 'preboot', pluginName: 'fixture' }),
    ).rejects.toThrow('built-in plugin kind cannot be changed')

    const trx = createTrx()
    trx.selected.set('plugin', { loaderName: 'zip', meta: pluginArchive.meta })
    mocks.defaultTrx = trx
    await PluginDB.useSetKind().setKind({ kind: 'preboot', pluginName: 'fixture' })

    expect(trx.calls.updates[0]).toEqual({
      set: { meta: JSON.stringify({ ...pluginArchive.meta, kind: 'preboot' }) },
      table: 'plugin',
      where: [['pluginName', '=', 'fixture']],
    })
    expect((PluginDB.useQuery(vi.fn() as never, ['enabled']) as any).key()).toContain('enabled')
  })
})