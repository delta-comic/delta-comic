import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => {
  const registry = () => ({ set: vi.fn() })
  return {
    addBarcode: vi.fn(),
    addCategories: vi.fn(),
    addGlobalNode: vi.fn(),
    addHotSearch: vi.fn(),
    addLevelboard: vi.fn(),
    addMainList: vi.fn(),
    addTabbar: vi.fn(),
    addTopButton: vi.fn(),
    authorIcon: registry(),
    commentRow: registry(),
    configRegister: vi.fn(),
    contentPages: registry(),
    createForm: vi.fn(),
    dependencyProvide: vi.fn(),
    dialogCreate: vi.fn(),
    downloadProviders: registry(),
    fork: registry(),
    i18nRegister: vi.fn(),
    itemCards: registry(),
    itemTranslator: registry(),
    layouts: registry(),
    pageAuthMount: vi.fn(async () => ({ token: 'website-token' })),
    precedenceFork: registry(),
    processInstances: registry(),
    runOtherProgress: vi.fn(async () => undefined),
    share: registry(),
    shareToken: registry(),
    subscribes: registry(),
    testApi: vi.fn(),
    testResourceApi: vi.fn(),
    userActions: registry(),
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
vi.mock('@delta-comic/ui', () => ({ createForm: mocks.createForm }))
vi.mock('@delta-comic/utils', () => ({
  PageWebviewAuth: class {
    constructor(
      public url: string,
      public injectCode: unknown,
      public options: unknown,
    ) {}
    mount = mocks.pageAuthMount
  },
}))
vi.mock('naive-ui', () => ({
  NModal: { name: 'NModal' },
  useDialog: () => ({ create: mocks.dialogCreate }),
}))
vi.mock('@/config', () => ({ useConfig: () => ({ $registerConfig: mocks.configRegister }) }))
vi.mock('@/depends', () => ({
  declareDepType: (name: string) => `dependency:${name}`,
  provide: mocks.dependencyProvide,
}))
vi.mock('@/driver/store', () => ({
  usePluginStore: () => ({ $getI18nName: (name: string) => `Display ${name}` }),
}))
vi.mock('@/global', () => ({
  Global: {
    addBarcode: mocks.addBarcode,
    addCategories: mocks.addCategories,
    addGlobalNode: mocks.addGlobalNode,
    addHotSearch: mocks.addHotSearch,
    addLevelboard: mocks.addLevelboard,
    addMainList: mocks.addMainList,
    addTabbar: mocks.addTabbar,
    addTopButton: mocks.addTopButton,
    share: mocks.share,
    shareToken: mocks.shareToken,
    subscribes: mocks.subscribes,
    userActions: mocks.userActions,
  },
}))
vi.mock('@/i18n', () => ({
  pluginI18n: {
    register: mocks.i18nRegister,
    translate: (key: string, values?: Record<string, string>) =>
      values ? `${key}:${Object.values(values).join(',')}` : key,
  },
  pluginMessageKey: (key: string) => key,
}))
vi.mock('@/plugin/otherProgress', () => ({ runOtherProgress: mocks.runOtherProgress }))
vi.mock('./utils', () => ({ testApi: mocks.testApi, testResourceApi: mocks.testResourceApi }))

import configSetter from './0_configSetter'
import i18n from './5_i18n'
import apiTest from './10_apiTest'
import resourceTest from './20_resourceTest'
import boot from './30_boot'
import auth from './40_auth'
import otherProgress from './50_otherProcess'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('core registration booters', () => {
  it('registers every configured content, resource, search, user, subscription, share, and config extension', async () => {
    const setMeta = vi.fn()
    const values = {
      barcode: { key: 'barcode' },
      category: { name: 'category' },
      commentRow: {},
      config: { key: Symbol('config') },
      contentPage: {},
      downloadProvider: { resolve: vi.fn() },
      itemCard: {},
      itemTranslator: vi.fn(),
      hotSearch: { title: 'hot search' },
      layout: {},
      levelBoard: { name: 'level' },
      mainList: { name: 'main' },
      resourceProcess: vi.fn(),
      resourceType: { test: vi.fn(), type: 'image', urls: ['https://cdn.test'] },
      share: { key: 'share' },
      shareToken: { key: 'token' },
      subscribe: { name: 'subscribe' },
      tabbar: { name: 'tab' },
      topButton: { name: 'top' },
      userAction: { name: 'action' },
      userCard: {},
      userEditor: {},
      userIcon: {},
    }

    await configSetter.call(
      {
        config: [values.config],
        content: {
          manga: {
            commentRow: values.commentRow,
            contentPage: values.contentPage,
            downloadProvider: values.downloadProvider,
            itemCard: values.itemCard,
            itemTranslator: values.itemTranslator,
            layout: values.layout,
          },
        },
        name: 'fixture',
        resource: { process: { resize: values.resourceProcess }, types: [values.resourceType] },
        search: {
          barcode: [values.barcode],
          categories: [values.category],
          hotPage: {
            levelBoard: [values.levelBoard],
            mainListCard: [values.mainList],
            topButton: [values.topButton],
          },
          hotSearch: [values.hotSearch],
          tabbar: [values.tabbar],
        },
        share: { initiative: [values.share], tokenListen: [values.shareToken] },
        subscribe: { author: values.subscribe },
        user: {
          authorIcon: { author: values.userIcon },
          card: values.userCard,
          edit: values.userEditor,
          userActions: { follow: values.userAction },
        },
      } as never,
      setMeta,
    )

    expect(setMeta).toHaveBeenCalledWith('plugin.runtime.steps.presets.applying')
    expect(mocks.layouts.set).toHaveBeenCalledWith('manga', values.layout)
    expect(mocks.itemCards.set).toHaveBeenCalledWith('manga', values.itemCard)
    expect(mocks.contentPages.set).toHaveBeenCalledWith('manga', values.contentPage)
    expect(mocks.downloadProviders.set).toHaveBeenCalledWith('manga', values.downloadProvider)
    expect(mocks.commentRow.set).toHaveBeenCalledWith('manga', values.commentRow)
    expect(mocks.itemTranslator.set).toHaveBeenCalledWith('manga', values.itemTranslator)
    expect(mocks.fork.set).toHaveBeenCalledWith(['fixture', 'image'], values.resourceType)
    expect(mocks.processInstances.set).toHaveBeenCalledWith(
      ['fixture', 'resize'],
      values.resourceProcess,
    )
    expect(mocks.addCategories).toHaveBeenCalledWith('fixture', values.category)
    expect(mocks.addTabbar).toHaveBeenCalledWith('fixture', values.tabbar)
    expect(mocks.addMainList).toHaveBeenCalledWith('fixture', values.mainList)
    expect(mocks.addLevelboard).toHaveBeenCalledWith('fixture', values.levelBoard)
    expect(mocks.addTopButton).toHaveBeenCalledWith('fixture', values.topButton)
    expect(mocks.addBarcode).toHaveBeenCalledWith('fixture', values.barcode)
    expect(mocks.addHotSearch).toHaveBeenCalledWith('fixture', values.hotSearch)
    expect(mocks.userCards.set).toHaveBeenCalledWith('fixture', values.userCard)
    expect(mocks.userEditorBase.set).toHaveBeenCalledWith('fixture', values.userEditor)
    expect(mocks.userActions.set).toHaveBeenCalledWith(['fixture', 'follow'], values.userAction)
    expect(mocks.authorIcon.set).toHaveBeenCalledWith(['fixture', 'author'], values.userIcon)
    expect(mocks.subscribes.set).toHaveBeenCalledWith(['fixture', 'author'], values.subscribe)
    expect(mocks.configRegister).toHaveBeenCalledWith(values.config)
    expect(mocks.share.set).toHaveBeenCalledWith(['fixture', 'share'], values.share)
    expect(mocks.shareToken.set).toHaveBeenCalledWith(['fixture', 'token'], values.shareToken)
  })

  it('does nothing for an empty config', async () => {
    await configSetter.call({ name: 'empty' }, vi.fn())

    expect(mocks.layouts.set).not.toHaveBeenCalled()
    expect(mocks.configRegister).not.toHaveBeenCalled()
  })
})

describe('core connectivity booters', () => {
  it('records reachable API namespaces for later boot stages', async () => {
    mocks.testApi
      .mockResolvedValueOnce(['https://a.test', 12])
      .mockResolvedValueOnce(['https://b.test', 20])
    const setMeta = vi.fn()
    const environment: Record<string, unknown> = {}

    await apiTest.call(
      { api: { first: {}, second: {} }, name: 'fixture' } as never,
      setMeta,
      environment,
    )

    expect(environment.api).toEqual({ first: 'https://a.test', second: 'https://b.test' })
    expect(setMeta).toHaveBeenLastCalledWith(expect.stringContaining('first -> 12 ms'))
  })

  it('rejects the API stage when any namespace is unreachable', async () => {
    mocks.testApi.mockResolvedValueOnce(['', false])
    const setMeta = vi.fn()

    await expect(
      apiTest.call({ api: { failed: {} }, name: 'fixture' } as never, setMeta, {}),
    ).rejects.toThrow('can not connect to server')
    expect(setMeta).toHaveBeenLastCalledWith('plugin.runtime.steps.tests.unreachable')
  })

  it('selects successful resource forks and rejects a partial outage', async () => {
    const setMeta = vi.fn()
    mocks.testResourceApi
      .mockResolvedValueOnce(['https://a.test', 5])
      .mockResolvedValueOnce(['', false])

    await expect(
      resourceTest.call(
        {
          name: 'fixture',
          resource: {
            types: [
              { type: 'image', urls: ['https://a.test'] },
              { type: 'video', urls: ['https://b.test'] },
            ],
          },
        } as never,
        setMeta,
      ),
    ).rejects.toThrow('can not connect to server')

    expect(mocks.precedenceFork.set).toHaveBeenCalledWith(['fixture', 'image'], 'https://a.test')
    expect(mocks.precedenceFork.set).not.toHaveBeenCalledWith(
      ['fixture', 'video'],
      expect.anything(),
    )
  })

  it('skips connectivity work when no APIs or resource types are declared', async () => {
    await apiTest.call({ name: 'fixture' }, vi.fn(), {})
    await resourceTest.call({ name: 'fixture' }, vi.fn())

    expect(mocks.testApi).not.toHaveBeenCalled()
    expect(mocks.testResourceApi).not.toHaveBeenCalled()
  })
})

describe('core post-connectivity booters', () => {
  it('registers i18n, dependency exposure, and other progress actions', async () => {
    const dictionary = { en: { title: 'Fixture' } }
    const exposure = { api: 'exposed' }
    const onBooted = vi.fn(async ({ api }) => {
      expect(api).toEqual({ main: 'https://api.test' })
      return exposure
    })
    const steps = [{ name: 'migrate' }]
    const setMeta = vi.fn()

    await i18n.call({ i18n: dictionary, name: 'fixture' } as never)
    await boot.call({ name: 'fixture', onBooted } as never, undefined, {
      api: { main: 'https://api.test' },
    })
    await otherProgress.call({ name: 'fixture', otherProgress: steps } as never, setMeta)

    expect(mocks.i18nRegister).toHaveBeenCalledWith('fixture', dictionary)
    expect(mocks.dependencyProvide).toHaveBeenCalledWith('dependency:fixture', exposure)
    expect(mocks.runOtherProgress).toHaveBeenCalledWith(steps, { setMeta })
  })

  it('skips optional post-connectivity hooks when absent or empty', async () => {
    await i18n.call({ name: 'fixture' })
    await boot.call({ name: 'fixture' }, undefined, {})
    await otherProgress.call({ name: 'fixture', otherProgress: [] }, vi.fn())

    expect(mocks.i18nRegister).not.toHaveBeenCalled()
    expect(mocks.dependencyProvide).not.toHaveBeenCalled()
    expect(mocks.runOtherProgress).not.toHaveBeenCalled()
  })
})

describe('core authentication booter', () => {
  it('passes form and website methods to the selected login handler', async () => {
    const formData = Promise.resolve({ username: 'reader' })
    mocks.createForm.mockReturnValue({ comp: {}, data: formData })
    const logIn = vi.fn(async by => {
      await expect(by.form({})).resolves.toEqual({ username: 'reader' })
      await expect(by.website('https://login.test', 'inject')).resolves.toEqual({
        token: 'website-token',
      })
    })
    const setMeta = vi.fn()

    await auth.call(
      { auth: { logIn, passSelect: vi.fn(async () => 'logIn') }, name: 'fixture' } as never,
      setMeta,
    )

    expect(logIn).toHaveBeenCalledOnce()
    expect(mocks.addGlobalNode).toHaveBeenCalledWith(expect.any(Object), 'fixture')
    expect(mocks.pageAuthMount).toHaveBeenCalledOnce()
    expect(setMeta).toHaveBeenLastCalledWith('plugin.runtime.steps.auth.success')
  })

  it('asks the user to choose signup and releases the popup mutex afterwards', async () => {
    mocks.dialogCreate.mockImplementationOnce(options => {
      options.onNegativeClick()
      return {}
    })
    const signUp = vi.fn(async () => undefined)

    await auth.call(
      { auth: { passSelect: vi.fn(async () => false), signUp }, name: 'fixture' } as never,
      vi.fn(),
    )

    expect(signUp).toHaveBeenCalledOnce()
    expect(mocks.dialogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ closable: false, maskClosable: false, title: 'Display fixture' }),
    )
  })

  it('reports authentication errors and allows the next plugin to acquire the mutex', async () => {
    const setMeta = vi.fn()
    await expect(
      auth.call(
        {
          auth: {
            logIn: vi.fn(async () => Promise.reject(new Error('login failed'))),
            passSelect: vi.fn(async () => 'logIn'),
          },
          name: 'broken',
        } as never,
        setMeta,
      ),
    ).rejects.toThrow('login failed')
    expect(setMeta).toHaveBeenLastCalledWith(expect.stringContaining('login failed'))

    const nextLogin = vi.fn(async () => undefined)
    await auth.call(
      { auth: { logIn: nextLogin, passSelect: vi.fn(async () => 'logIn') }, name: 'next' } as never,
      vi.fn(),
    )
    expect(nextLogin).toHaveBeenCalledOnce()
  })

  it('does nothing when a plugin has no auth contract', async () => {
    await auth.call({ name: 'fixture' }, vi.fn())
    expect(mocks.dialogCreate).not.toHaveBeenCalled()
  })
})