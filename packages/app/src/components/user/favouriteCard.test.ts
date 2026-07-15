import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { SetupContext } from 'vue'

const { favouriteItems } = await vi.hoisted(async () => {
  // @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
  await import('../../../public/runtime/host-libraries.umd.js')
  const vueRuntimePath = '../../../node_modules/vue/dist/vue.esm-bundler.js'
  const Vue = (await import(/* @vite-ignore */ vueRuntimePath)) as typeof import('vue')
  window.$$lib$$ = { ...window.$$lib$$, Vue } as typeof window.$$lib$$
  return { favouriteItems: Vue.shallowRef<Array<Record<string, unknown>>>([]) }
})

await vi.hoisted(async () => {
  const { defineComponent, h } = window.$$lib$$.Vue
  const passthrough = (name: string, tag = 'div') =>
    defineComponent({
      name,
      inheritAttrs: false,
      setup:
        (_props: Record<string, never>, { attrs, slots }: SetupContext) =>
        () =>
          h(tag, attrs, [slots.icon?.(), slots.default?.()]),
    })

  window.$$lib$$.Naive = {
    ...window.$$lib$$.Naive,
    NButton: passthrough('NButton', 'button'),
    NEmpty: passthrough('NEmpty'),
    NIcon: passthrough('NIcon', 'span'),
  }
})

vi.mock('@delta-comic/db', () => ({
  FavouriteDB: {
    useQueryItem: () => ({
      state: window.$$lib$$.Vue.computed(() => ({ data: favouriteItems.value, status: 'success' }))
        .value,
    }),
  },
}))
vi.mock('@delta-comic/model', () => ({
  uni: { image: { Image: { create: (cover: unknown) => cover } } },
}))
vi.mock('@delta-comic/ui', () => {
  const { defineComponent, h } = window.$$lib$$.Vue
  return {
    DcImage: defineComponent({
      name: 'DcImage',
      setup: () => () => h('div', { class: 'dc-image' }),
    }),
    DcState: defineComponent({
      name: 'DcState',
      props: { state: { type: Object, required: true } },
      setup:
        (props: { state: { data: unknown[] } }, { slots }: SetupContext) =>
        () =>
          slots.default?.({ data: props.state.data }),
    }),
  }
})
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/icons', () => ({
  Icons: { antd: { FolderOutlined: {}, LockOutlined: {} }, material: { ArrowForwardIosRound: {} } },
}))

import FavouriteCard from './favouriteCard.vue'

const card = { createAt: 1, description: '', private: true, title: 'Default' }

describe('FavouriteCard', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    favouriteItems.value = []
  })

  afterEach(() => wrapper?.unmount())

  it('opens an empty folder from the compact list without dereferencing a missing cover', async () => {
    wrapper = mount(FavouriteCard, { props: { card, isCardMode: false } })

    await wrapper.get('[aria-label="favourite.actions.openFolder"]').trigger('click')

    expect(wrapper.emitted('open')).toEqual([[]])
    expect(wrapper.text()).toContain('common.units.contentCount')
  })

  it('emits the unsupported play action independently from opening the folder', async () => {
    wrapper = mount(FavouriteCard, { props: { card, isCardMode: false } })

    await wrapper.get('[aria-label="favourite.actions.playFolder"]').trigger('click')

    expect(wrapper.emitted('play')).toEqual([[]])
    expect(wrapper.emitted('open')).toBeUndefined()
  })
})