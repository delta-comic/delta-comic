import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  environmentRemoveOwner: vi.fn(),
  environmentWithOwner: vi.fn(async (_owner: string, action: () => Promise<unknown>) => action()),
  getI18nName: vi.fn((plugin: string) => `name:${plugin}`),
  runtimeRemoveOwner: vi.fn(),
  runtimeWithOwner: vi.fn(async (_owner: string, action: () => Promise<unknown>) => action()),
  sharedCall: vi.fn(),
}))

vi.mock('@delta-comic/model', () => ({
  SourcedKeyMap: { createReactive: () => new Map() },
  UniContentPage: {
    contentPages: {
      key: {
        toJSON: (value: string) => `json:${value}`,
        toString: (value: string) => `string:${value}`,
      },
    },
  },
}))
vi.mock('@delta-comic/ui', () => ({
  environmentRegistry: {
    removeOwner: mocks.environmentRemoveOwner,
    withOwner: mocks.environmentWithOwner,
  },
}))
vi.mock('@delta-comic/utils', () => ({ SharedFunction: { call: mocks.sharedCall } }))
vi.mock('@/i18n', () => ({
  pluginI18n: {
    translate: (key: string, values?: Record<string, string>) =>
      values ? `${key}:${Object.values(values).join(',')}` : key,
  },
  pluginMessageKey: (key: string) => key,
}))
vi.mock('../../lib/driver', () => ({ usePluginStore: () => ({ $getI18nName: mocks.getI18nName }) }))
vi.mock('../../lib/driver/extensions', () => ({
  runtimeExtensions: { removeOwner: mocks.runtimeRemoveOwner, withOwner: mocks.runtimeWithOwner },
}))
vi.mock('../../lib/driver/icon', () => ({ OfflineShareRound: {}, TagOutlined: {} }))

import { Global } from '../../lib/global'

const findCore = (map: Map<unknown, any>, key: string): any =>
  [...map.values()].find(value => value.key === key)!

beforeEach(() => {
  vi.clearAllMocks()
  for (const map of [
    Global.tabbar,
    Global.categories,
    Global.barcode,
    Global.hotSearch,
    Global.levelboard,
    Global.topButton,
    Global.mainLists,
  ]) {
    map.clear()
  }
  Global.globalNodes.splice(0)
})

describe('global plugin registrations', () => {
  it('tracks ambient owners and removes only their global nodes and extensions', async () => {
    const alphaNode = { name: 'AlphaNode' }
    const betaNode = { name: 'BetaNode' }

    await Global.withRegistrationOwner('alpha', async () => {
      Global.addGlobalNode(alphaNode as never)
      await Global.withRegistrationOwner('beta', async () => {
        Global.addGlobalNode(betaNode as never)
      })
    })

    Global.removeOwnedRegistrations('alpha')

    expect(Global.globalNodes).toEqual([betaNode])
    expect(mocks.runtimeWithOwner).toHaveBeenCalledWith('alpha', expect.any(Function))
    expect(mocks.environmentWithOwner).toHaveBeenCalledWith('beta', expect.any(Function))
    expect(mocks.environmentRemoveOwner).toHaveBeenCalledExactlyOnceWith('alpha')
    expect(mocks.runtimeRemoveOwner).toHaveBeenCalledExactlyOnceWith('alpha')
  })

  it('appends search registrations without replacing previous values', () => {
    Global.addTabbar('fixture', { name: 'one' } as never)
    Global.addTabbar('fixture', { name: 'two' } as never)
    Global.addCategories('fixture', { name: 'category' } as never)
    Global.addBarcode('fixture', { name: 'barcode' } as never)
    Global.addHotSearch('fixture', { title: 'hot search' } as never)
    Global.addLevelboard('fixture', { name: 'level' } as never)
    Global.addTopButton('fixture', { name: 'button' } as never)
    Global.addMainList('fixture', { name: 'list' } as never)

    expect(Global.tabbar.get('fixture')).toEqual([{ name: 'one' }, { name: 'two' }])
    expect(Global.categories.get('fixture')).toHaveLength(1)
    expect(Global.barcode.get('fixture')).toHaveLength(1)
    expect(Global.hotSearch.get('fixture')).toHaveLength(1)
    expect(Global.levelboard.get('fixture')).toHaveLength(1)
    expect(Global.topButton.get('fixture')).toHaveLength(1)
    expect(Global.mainLists.get('fixture')).toHaveLength(1)
  })
})

describe('built-in share contracts', () => {
  const page = {
    id: 'content-1',
    plugin: 'fixture',
    preload: {
      toJSON: () => ({ contentType: 'manga', thisEp: { id: 'ep-2' }, title: 'Fixture title' }),
    },
  }

  it('creates a token that can be recognized and routed back to the content', async () => {
    const tokenShare = findCore(Global.share as never, 'token')
    const tokenReader = findCore(Global.shareToken as never, 'token')

    expect(tokenShare.filter({ preload: undefined })).toBe(false)
    const { token } = await tokenShare.call(page)
    expect(tokenReader.patten(token)).toBe(true)
    expect(tokenReader.patten('ordinary clipboard text')).toBe(false)

    const dialog = tokenReader.show(token)
    expect(dialog.detail).toContain('name:fixture')
    expect(dialog.onNegative()).toBeUndefined()
    dialog.onPositive()
    expect(mocks.sharedCall).toHaveBeenCalledExactlyOnceWith(
      'routeToContent',
      'json:string:manga',
      'content-1',
      'ep-2',
    )
  })

  it('delegates native shares to the platform with the generated token', async () => {
    const share = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { share })
    const nativeShare = findCore(Global.share as never, 'native')

    const result = await nativeShare.call(page)

    expect(share).toHaveBeenCalledWith({ text: result.token, title: 'plugin.share.nativeTitle' })
  })

  it('rejects share calls whose content detail was not preloaded', async () => {
    const tokenShare = findCore(Global.share as never, 'token')

    await expect(tokenShare.call({ ...page, preload: undefined })).rejects.toThrow(
      'Not found preload',
    )
  })
})