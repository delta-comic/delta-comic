import type { PluginArchiveDB } from '@delta-comic/db'
import type { AwesomeMarketplaceEntry, PrebootRecovery } from '@delta-comic/plugin'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vite-plus/test'

const pluginMocks = vi.hoisted(() => ({
  resolvePluginIconUrl: vi.fn(async (pluginId: string | undefined, icon: string | undefined) => {
    if (!icon || /^https?:/i.test(icon)) return icon
    if (!pluginId) throw new Error('missing plugin id')
    return `blob:${pluginId}/${icon}`
  }),
}))

vi.mock('@delta-comic/plugin', () => ({ resolvePluginIconUrl: pluginMocks.resolvePluginIconUrl }))

await vi.hoisted(async () => {
  const vueRuntimePath = '../../../../node_modules/vue/dist/vue.esm-bundler.js'
  const Vue = (await import(/* @vite-ignore */ vueRuntimePath)) as typeof import('vue')
  const { defineComponent, h } = Vue
  const Button = defineComponent({
    name: 'NButton',
    inheritAttrs: false,
    props: { disabled: Boolean, loading: Boolean },
    emits: ['click'],
    setup:
      (props, { attrs, emit, slots }) =>
      () =>
        h(
          'button',
          {
            ...attrs,
            'data-loading': String(props.loading),
            'disabled': props.disabled,
            'onClick': () => emit('click'),
          },
          slots.default?.(),
        ),
  })
  const Input = defineComponent({
    name: 'NInput',
    props: { value: String },
    emits: ['update:value'],
    setup:
      (props, { emit }) =>
      () =>
        h('input', {
          value: props.value,
          onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value),
        }),
  })
  const Select = defineComponent({
    name: 'NSelect',
    props: { options: Array, value: String },
    emits: ['update:value'],
    setup:
      (props, { emit }) =>
      () =>
        h(
          'select',
          {
            value: props.value,
            onChange: (event: Event) =>
              emit('update:value', (event.target as HTMLSelectElement).value),
          },
          (props.options as Array<{ label: string; value: string }> | undefined)?.map(option =>
            h('option', { value: option.value }, option.label),
          ),
        ),
  })
  const Card = defineComponent({
    name: 'NCard',
    setup:
      (_props, { slots }) =>
      () =>
        h('article', [
          h('header', slots.header?.()),
          h('main', slots.default?.()),
          h('footer', slots.action?.()),
        ]),
  })
  const Tag = defineComponent({
    name: 'NTag',
    setup:
      (_props, { slots }) =>
      () =>
        h('span', slots.default?.()),
  })
  const Alert = defineComponent({
    name: 'NAlert',
    emits: ['close'],
    setup:
      (_props, { emit, slots }) =>
      () =>
        h('section', [
          slots.default?.(),
          h('button', { class: 'close', onClick: () => emit('close') }),
        ]),
  })
  window.$$lib$$ = {
    ...window.$$lib$$,
    Naive: {
      NAlert: Alert,
      NButton: Button,
      NCard: Card,
      NInput: Input,
      NSelect: Select,
      NTag: Tag,
    },
    Vue,
  } as typeof window.$$lib$$
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'en-US' },
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}))

import type { PluginMarketplaceItem } from '@/features/pluginMarketplace/model'

import PrebootRecoveryAlert from '../PrebootRecoveryAlert.vue'

import PluginMarketplaceCard from './PluginMarketplaceCard.vue'
import PluginMarketplaceFilters from './PluginMarketplaceFilters.vue'

const marketplaceItem = (overrides: Partial<PluginMarketplaceItem> = {}): PluginMarketplaceItem => {
  const entry: AwesomeMarketplaceEntry = {
    listing: {
      authors: ['Delta Comic'],
      download: { repository: 'delta-comic/reader', type: 'github' },
      id: 'reader',
      release: {
        manifestUrl: 'https://example.test/manifest.json',
        publishedAt: '2026-01-01T00:00:00.000Z',
        url: 'https://example.test/release',
        version: '2.0.0',
      },
      schemaVersion: 1,
    },
    manifest: {
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

describe('PluginMarketplaceFilters', () => {
  it('emits typed model updates and refresh through its public controls', async () => {
    const wrapper = mount(PluginMarketplaceFilters, {
      props: { filter: 'all', loading: false, query: '', stale: false, total: 3 },
    })

    await wrapper.get('input').setValue('reader')
    await wrapper.get('select').setValue('updates')
    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('update:query')).toEqual([['reader']])
    expect(wrapper.emitted('update:filter')).toEqual([['updates']])
    expect(wrapper.emitted('refresh')).toEqual([[]])
    expect(wrapper.text()).toContain('plugin.market.loadedCount:{"count":3}')
  })

  it('renders stale state and forwards loading to the refresh action', () => {
    const wrapper = mount(PluginMarketplaceFilters, {
      props: { filter: 'all', loading: true, query: '', stale: true, total: 0 },
    })

    expect(wrapper.text()).toContain('plugin.market.stale')
    expect(wrapper.get('button').attributes('data-loading')).toBe('true')
  })
})

describe('PluginMarketplaceCard', () => {
  it('renders verified metadata and emits details/install from enabled actions', async () => {
    const wrapper = mount(PluginMarketplaceCard, {
      props: { installing: false, item: marketplaceItem() },
    })
    const buttons = wrapper.findAll('button')

    expect(wrapper.text()).toContain('Reader')
    expect(wrapper.text()).toContain('Reads comics')
    expect(wrapper.text()).toContain('plugin.market.compatibility.compatible')
    await flushPromises()
    expect(wrapper.get('img').attributes('src')).toBe('https://cdn.example.test/reader.png')
    expect(buttons[1].attributes('disabled')).toBeUndefined()
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')

    expect(wrapper.emitted('details')).toEqual([[]])
    expect(wrapper.emitted('install')).toEqual([[]])
  })

  it('falls back to the plugin initial when its icon cannot load', async () => {
    const wrapper = mount(PluginMarketplaceCard, {
      props: { installing: false, item: marketplaceItem() },
    })
    await flushPromises()

    await wrapper.get('img').trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('.plugin-icon').text()).toBe('R')
  })

  it('resolves an installed plugin icon from its local archive path', async () => {
    const item = marketplaceItem()
    item.manifest!.icon = 'assets/icon.png'
    item.installed = { meta: item.manifest, pluginName: 'reader' } as PluginArchiveDB.Archive
    const wrapper = mount(PluginMarketplaceCard, { props: { installing: false, item } })
    await flushPromises()

    expect(wrapper.get('img').attributes('src')).toBe('blob:reader/assets/icon.png')
    expect(pluginMocks.resolvePluginIconUrl).toHaveBeenCalledWith('reader', 'assets/icon.png')
  })

  it('disables current or incompatible installs and exposes update progress', () => {
    const installed = {
      meta: { version: { plugin: '2.0.0' } },
      pluginName: 'reader',
    } as PluginArchiveDB.Archive
    const currentWrapper = mount(PluginMarketplaceCard, {
      props: { installing: false, item: marketplaceItem({ installed, updateAvailable: false }) },
    })
    expect(currentWrapper.findAll('button')[1].attributes('disabled')).toBeDefined()
    expect(currentWrapper.text()).toContain('plugin.market.states.installed')

    const updateWrapper = mount(PluginMarketplaceCard, {
      props: { installing: true, item: marketplaceItem({ installed, updateAvailable: true }) },
    })
    expect(updateWrapper.findAll('button')[1].attributes('disabled')).toBeUndefined()
    expect(updateWrapper.findAll('button')[1].attributes('data-loading')).toBe('true')
    expect(updateWrapper.text()).toContain('plugin.market.actions.update')

    const incompatibleWrapper = mount(PluginMarketplaceCard, {
      props: { installing: false, item: marketplaceItem({ compatibility: 'incompatible' }) },
    })
    expect(incompatibleWrapper.findAll('button')[1].attributes('disabled')).toBeDefined()
  })
})

describe('PrebootRecoveryAlert', () => {
  it('shows the recovery reason and affected plugins and emits both recovery actions', async () => {
    const recovery = {
      plugins: ['reader', 'sync'],
      reason: 'previous preboot crashed',
    } as PrebootRecovery
    const wrapper = mount(PrebootRecoveryAlert, { props: { recovery } })

    expect(wrapper.text()).toContain('previous preboot crashed')
    expect(wrapper.text()).toContain('plugin.recovery.affected:{"plugins":"reader, sync"}')
    await wrapper.get('button:not(.close)').trigger('click')
    await wrapper.get('.close').trigger('click')

    expect(wrapper.emitted('manage')).toEqual([[]])
    expect(wrapper.emitted('dismiss')).toEqual([[]])
  })
})