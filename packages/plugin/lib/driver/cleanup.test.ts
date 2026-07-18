import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => {
  const registry = () => ({ delete: vi.fn() })
  return {
    authorIcon: registry(),
    barcode: registry(),
    categories: registry(),
    commentRow: registry(),
    configUnregister: vi.fn(),
    contentPages: registry(),
    defaultDependencyDelete: vi.fn(),
    downloadProviders: registry(),
    fork: registry(),
    globalRemoveOwned: vi.fn(),
    hotSearch: registry(),
    itemCards: registry(),
    itemTranslator: registry(),
    layouts: registry(),
    levelboard: registry(),
    mainLists: registry(),
    pluginI18nRemove: vi.fn(),
    pluginStore: registry(),
    precedenceFork: registry(),
    processInstances: registry(),
    releaseObjectUrls: vi.fn(),
    share: new Map<string, unknown>(),
    shareToken: new Map<string, unknown>(),
    subscribes: new Map<string, unknown>(),
    tabbar: registry(),
    topButton: registry(),
    userActions: new Map<string, unknown>(),
    userCards: registry(),
    userEditorBase: registry(),
  }
})

vi.mock('@delta-comic/model', () => ({
  uni: {
    comment: { Comment: { commentRow: mocks.commentRow } },
    content: {
      ContentPage: {
        contentPages: mocks.contentPages,
        downloadProviders: mocks.downloadProviders,
        layouts: mocks.layouts,
      },
    },
    item: {
      Item: {
        authorIcon: mocks.authorIcon,
        itemCards: mocks.itemCards,
        itemTranslator: mocks.itemTranslator,
      },
    },
    resource: {
      Resource: {
        fork: mocks.fork,
        precedenceFork: mocks.precedenceFork,
        processInstances: mocks.processInstances,
      },
    },
    user: { User: { userCards: mocks.userCards, userEditorBase: mocks.userEditorBase } },
  },
}))
vi.mock('@/config', () => ({ useConfig: () => ({ $unregisterConfig: mocks.configUnregister }) }))
vi.mock('@/depends', () => ({
  declareDepType: (plugin: string) => `dependency:${plugin}`,
  defaultDependencyRegistry: { delete: mocks.defaultDependencyDelete },
}))
vi.mock('@/global', () => ({
  Global: {
    barcode: mocks.barcode,
    categories: mocks.categories,
    hotSearch: mocks.hotSearch,
    levelboard: mocks.levelboard,
    mainLists: mocks.mainLists,
    removeOwnedRegistrations: mocks.globalRemoveOwned,
    share: mocks.share,
    shareToken: mocks.shareToken,
    subscribes: mocks.subscribes,
    tabbar: mocks.tabbar,
    topButton: mocks.topButton,
    userActions: mocks.userActions,
  },
}))
vi.mock('@/i18n', () => ({ pluginI18n: { remove: mocks.pluginI18nRemove } }))
vi.mock('./init/storage', () => ({ releasePluginObjectUrls: mocks.releaseObjectUrls }))
vi.mock('./store', () => ({ usePluginStore: () => ({ plugins: mocks.pluginStore }) }))

import { cleanupPlugin } from './cleanup'

beforeEach(() => {
  vi.clearAllMocks()
  for (const map of [mocks.share, mocks.shareToken, mocks.subscribes, mocks.userActions]) {
    map.clear()
    map.set('fixture:owned', {})
    map.set('other:preserved', {})
  }
})

describe('plugin cleanup', () => {
  it('removes every registration owned or declared by the plugin', () => {
    const ownStyle = { dataset: { plugin: 'fixture' }, remove: vi.fn() }
    const otherStyle = { dataset: { plugin: 'other' }, remove: vi.fn() }
    vi.stubGlobal('document', { querySelectorAll: vi.fn(() => [ownStyle, otherStyle]) })
    const configPointer = { key: Symbol('config') }

    cleanupPlugin({
      config: [configPointer],
      content: {
        manga: {
          commentRow: {},
          contentPage: {},
          downloadProvider: {},
          itemCard: {},
          itemTranslator: {},
          layout: {},
        },
      },
      name: 'fixture',
      resource: { process: { resize: {} }, types: [{ type: 'image' }] },
      user: { authorIcon: { author: {} }, card: {}, edit: {} },
    } as never)

    expect(mocks.globalRemoveOwned).toHaveBeenCalledExactlyOnceWith('fixture')
    expect(mocks.pluginI18nRemove).toHaveBeenCalledExactlyOnceWith('fixture')
    for (const map of [mocks.share, mocks.shareToken, mocks.subscribes, mocks.userActions]) {
      expect([...map.keys()]).toEqual(['other:preserved'])
    }
    expect(mocks.layouts.delete).toHaveBeenCalledWith('manga')
    expect(mocks.itemCards.delete).toHaveBeenCalledWith('manga')
    expect(mocks.contentPages.delete).toHaveBeenCalledWith('manga')
    expect(mocks.downloadProviders.delete).toHaveBeenCalledWith('manga')
    expect(mocks.commentRow.delete).toHaveBeenCalledWith('manga')
    expect(mocks.itemTranslator.delete).toHaveBeenCalledWith('manga')
    expect(mocks.fork.delete).toHaveBeenCalledWith(['fixture', 'image'])
    expect(mocks.precedenceFork.delete).toHaveBeenCalledWith(['fixture', 'image'])
    expect(mocks.processInstances.delete).toHaveBeenCalledWith(['fixture', 'resize'])
    expect(mocks.userCards.delete).toHaveBeenCalledWith('fixture')
    expect(mocks.userEditorBase.delete).toHaveBeenCalledWith('fixture')
    expect(mocks.authorIcon.delete).toHaveBeenCalledWith(['fixture', 'author'])
    expect(mocks.configUnregister).toHaveBeenCalledWith(configPointer)
    expect(mocks.defaultDependencyDelete).toHaveBeenCalledWith('dependency:fixture')
    expect(mocks.releaseObjectUrls).toHaveBeenCalledWith('fixture')
    expect(ownStyle.remove).toHaveBeenCalledOnce()
    expect(otherStyle.remove).not.toHaveBeenCalled()
  })

  it('continues cleanup after individual failures and reports all errors together', () => {
    mocks.tabbar.delete.mockImplementationOnce(() => {
      throw new Error('tabbar failed')
    })
    mocks.releaseObjectUrls.mockImplementationOnce(() => {
      throw new Error('url cleanup failed')
    })

    let caught: unknown
    try {
      cleanupPlugin({ name: 'fixture' })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(AggregateError)
    expect((caught as AggregateError).errors).toHaveLength(2)
    expect((caught as Error).message).toContain('fixture')
    for (const registry of [
      mocks.categories,
      mocks.barcode,
      mocks.hotSearch,
      mocks.levelboard,
      mocks.topButton,
      mocks.mainLists,
      mocks.pluginStore,
    ]) {
      expect(registry.delete).toHaveBeenCalled()
    }
    expect(mocks.globalRemoveOwned).toHaveBeenCalledWith('fixture')
  })
})