import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  dialog: { warning: vi.fn() },
  installPlugin: vi.fn(),
  message: { error: vi.fn(), success: vi.fn() },
  openExternal: vi.fn(),
  runPluginInstall: vi.fn(),
  updatePlugin: vi.fn(),
}))

const marketplaceMocks = vi.hoisted(() => ({
  refresh: vi.fn(async () => {}),
  refreshInstalled: vi.fn(async () => {}),
  items: [] as PluginMarketplaceItem[],
  setFilter: vi.fn(),
  setQuery: vi.fn(),
}))

await vi.hoisted(async () => {
  const vueRuntimePath = '../../../../../node_modules/vue/dist/vue.esm-bundler.js'
  const Vue = (await import(/* @vite-ignore */ vueRuntimePath)) as typeof import('vue')
  const { defineComponent, h } = Vue
  const Scrollbar = defineComponent({
    name: 'NScrollbar',
    setup:
      (_props, { slots }) =>
      () =>
        h('div', slots.default?.()),
  })
  window.$$lib$$ = {
    ...window.$$lib$$,
    Naive: {
      NScrollbar: Scrollbar,
      useDialog: () => mocks.dialog,
      useMessage: () => mocks.message,
    },
    Vue,
  } as typeof window.$$lib$$
})

vi.mock('@delta-comic/plugin', () => ({
  installPlugin: mocks.installPlugin,
  isPluginManifestCompatible: () => true,
  pluginCatalogInstallInput: (pluginId: string) => `catalog:${pluginId}`,
  updatePlugin: mocks.updatePlugin,
}))
vi.mock('@/features/pluginInstall/usePluginInstall', () => ({
  usePluginInstall: () => ({ runPluginInstall: mocks.runPluginInstall }),
}))
vi.mock('@/features/pluginMarketplace/usePluginMarketplace', () => ({
  usePluginMarketplace: () => ({
    error: { value: undefined },
    filter: { value: 'all' },
    hasMore: { value: false },
    items: { value: marketplaceMocks.items },
    loading: { value: false },
    loadingMore: { value: false },
    query: { value: '' },
    refresh: marketplaceMocks.refresh,
    refreshInstalled: marketplaceMocks.refreshInstalled,
    retry: vi.fn(),
    setFilter: marketplaceMocks.setFilter,
    setQuery: marketplaceMocks.setQuery,
    stale: { value: false },
    visibleItems: { value: marketplaceMocks.items },
  }),
}))
vi.mock('@/platform', () => ({ openExternal: mocks.openExternal }))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}))

vi.mock(
  '../../../../../src/components/plugin/marketplace/PluginMarketplaceFilters.vue',
  async () => {
    const { defineComponent, h } = await import('vue')
    return {
      default: defineComponent({
        name: 'PluginMarketplaceFilters',
        setup: () => () => h('section', { class: 'marketplace-filters' }),
      }),
    }
  },
)
vi.mock('../../../../../src/components/plugin/marketplace/PluginMarketplaceList.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'PluginMarketplaceList',
      props: { items: Array },
      emits: ['details', 'install'],
      setup:
        (props, { emit }) =>
        () =>
          h(
            'section',
            { class: 'marketplace-list' },
            (props.items as PluginMarketplaceItem[] | undefined)?.map(item =>
              h('div', [
                h('button', { class: 'install', onClick: () => emit('install', item) }, 'install'),
                h('button', { class: 'details', onClick: () => emit('details', item) }, 'details'),
              ]),
            ),
          ),
    }),
  }
})
vi.mock(
  '../../../../../src/components/plugin/marketplace/PluginMarketplaceDetails.vue',
  async () => {
    const { defineComponent, h } = await import('vue')
    return {
      default: defineComponent({
        name: 'PluginMarketplaceDetails',
        props: { busy: Boolean, item: Object, show: Boolean },
        emits: ['install', 'openSource', 'update:show'],
        setup:
          (props, { emit }) =>
          () =>
            h('section', { class: 'marketplace-details' }, [
              h('span', { class: 'busy' }, String(props.busy)),
              h('button', { class: 'install', onClick: () => emit('install') }, 'install'),
            ]),
      }),
    }
  },
)

import type {
  PluginMarketplaceEntry,
  PluginMarketplaceItem,
} from '@/features/pluginMarketplace/model'

import PluginMarketplaceContainer from '../../../../../src/components/plugin/marketplace/PluginMarketplaceContainer.vue'

const marketplaceItem = (overrides: Partial<PluginMarketplaceItem> = {}): PluginMarketplaceItem => {
  const entry: PluginMarketplaceEntry = {
    listing: {
      authors: ['Delta Comic'],
      id: 'reader',
      release: {
        manifestUrl: 'https://example.test/manifest.json',
        publishedAt: '2026-01-01T00:00:00.000Z',
        url: 'https://example.test/release',
        version: '2.0.0',
      },
      source: { repository: 'delta-comic/reader', type: 'github' },
    },
    manifest: {
      apiVersion: 1,
      author: 'Delta Comic',
      description: 'Reads comics',
      icon: 'https://cdn.example.test/reader.png',
      name: { display: 'Reader', id: 'reader' },
      require: [],
      version: { plugin: '2.0.0', supportCore: '^2.3.0' },
    },
  }
  return { ...entry, compatibility: 'compatible', updateAvailable: false, ...overrides }
}

interface DialogInstance {
  closable: boolean
  closeOnEsc: boolean
  content?: string
  loading: boolean
  maskClosable: boolean
  negativeButtonProps?: { disabled?: boolean }
  onAfterLeave?: () => void
  onPositiveClick?: () => unknown
  title?: string
}

describe('PluginMarketplaceContainer', () => {
  const item = marketplaceItem()

  beforeEach(() => {
    mocks.dialog.warning.mockReset()
    mocks.dialog.warning.mockImplementation((options: DialogInstance) => options)
    mocks.message.error.mockClear()
    mocks.message.success.mockClear()
    mocks.runPluginInstall.mockReset()
    marketplaceMocks.items.length = 0
    marketplaceMocks.items.push(item)
  })

  const mountContainer = async () => {
    const wrapper = mount(PluginMarketplaceContainer)
    await flushPromises()
    return wrapper
  }

  const installIn = (wrapper: VueWrapper, selector = '.marketplace-list .install') =>
    wrapper.get(selector).trigger('click')

  it('opens a single confirm dialog and installs exactly once per confirmation', async () => {
    let resolveInstall: (() => void) | undefined
    mocks.runPluginInstall.mockReturnValue(
      new Promise<void>(resolve => {
        resolveInstall = resolve
      }),
    )
    const wrapper = await mountContainer()

    await installIn(wrapper)
    expect(mocks.dialog.warning).toHaveBeenCalledTimes(1)
    const options = mocks.dialog.warning.mock.calls[0][0] as DialogInstance
    const instance = mocks.dialog.warning.mock.results[0].value as DialogInstance
    expect(options.title).toBe('plugin.market.confirm.installTitle')
    expect(options.content).toContain('https://github.com/delta-comic/reader')

    await installIn(wrapper)
    expect(mocks.dialog.warning).toHaveBeenCalledTimes(1)

    const install = options.onPositiveClick!()
    expect(instance.loading).toBe(true)
    expect(instance.negativeButtonProps).toEqual({ disabled: true })
    expect(instance.closable).toBe(false)
    expect(instance.maskClosable).toBe(false)
    expect(instance.closeOnEsc).toBe(false)
    expect(mocks.runPluginInstall).toHaveBeenCalledTimes(1)

    expect(options.onPositiveClick!()).toBe(false)
    expect(mocks.runPluginInstall).toHaveBeenCalledTimes(1)

    resolveInstall!()
    await flushPromises()
    await expect(install).resolves.toBeUndefined()

    expect(marketplaceMocks.refreshInstalled).toHaveBeenCalledTimes(1)
    expect(mocks.message.success).toHaveBeenCalledWith('plugin.market.messages.installed')

    options.onAfterLeave!()
    await installIn(wrapper)
    expect(mocks.dialog.warning).toHaveBeenCalledTimes(2)
  })

  it('closes the confirm dialog after a failed install', async () => {
    mocks.runPluginInstall.mockRejectedValue(new Error('download failed'))
    const wrapper = await mountContainer()

    await installIn(wrapper)
    const options = mocks.dialog.warning.mock.calls[0][0] as DialogInstance
    const install = options.onPositiveClick!()

    await expect(install).resolves.toBeUndefined()
    await flushPromises()
    expect(mocks.message.error).toHaveBeenCalledWith('download failed')
    expect(mocks.message.success).not.toHaveBeenCalled()
  })

  it('blocks installs of the same plugin while one is running', async () => {
    mocks.runPluginInstall.mockReturnValue(new Promise<void>(() => {}))
    const wrapper = await mountContainer()

    await installIn(wrapper)
    const options = mocks.dialog.warning.mock.calls[0][0] as DialogInstance
    options.onPositiveClick!()
    await flushPromises()

    await installIn(wrapper)
    expect(mocks.dialog.warning).toHaveBeenCalledTimes(1)
    expect(mocks.runPluginInstall).toHaveBeenCalledTimes(1)
  })

  it('reflects the confirming and installing states on the details panel', async () => {
    let resolveInstall: (() => void) | undefined
    mocks.runPluginInstall.mockReturnValue(
      new Promise<void>(resolve => {
        resolveInstall = resolve
      }),
    )
    const wrapper = await mountContainer()

    await wrapper.get('.marketplace-list .details').trigger('click')
    expect(wrapper.get('.marketplace-details .busy').text()).toBe('false')

    await installIn(wrapper)
    expect(wrapper.get('.marketplace-details .busy').text()).toBe('true')

    const options = mocks.dialog.warning.mock.calls[0][0] as DialogInstance
    options.onPositiveClick!()
    resolveInstall!()
    await flushPromises()
    options.onAfterLeave!()
    await flushPromises()

    expect(wrapper.get('.marketplace-details .busy').text()).toBe('false')
  })
})