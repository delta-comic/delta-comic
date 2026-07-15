import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { SetupContext } from 'vue'

const { activeComponent } = await vi.hoisted(async () => {
  // @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
  await import('../../../public/runtime/host-libraries.umd.js')
  const vueRuntimePath = '../../../node_modules/vue/dist/vue.esm-bundler.js'
  const Vue = (await import(/* @vite-ignore */ vueRuntimePath)) as typeof import('vue')
  window.$$lib$$ = { ...window.$$lib$$, Vue } as typeof window.$$lib$$
  return { activeComponent: Vue.shallowRef() }
})

vi.mock('@/components/user/favourite/FavouriteOverview.vue', () => ({
  default: { name: 'FavouriteOverview', template: '<div data-test="overview" />' },
}))

import FavouritePage from './favourite.vue'

const { defineComponent, h, nextTick } = window.$$lib$$.Vue
const RouterView = defineComponent({
  name: 'RouterView',
  setup:
    (_props: Record<string, never>, { slots }: SetupContext) =>
    () =>
      slots.default?.({ Component: activeComponent.value }),
})

describe('favourite route outlet', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => wrapper?.unmount())

  it('replaces the overview with the nested folder component when the outlet becomes active', async () => {
    activeComponent.value = undefined
    wrapper = mount(FavouritePage, { global: { components: { RouterView } } })
    expect(wrapper.find('[data-test="overview"]').exists()).toBe(true)

    activeComponent.value = defineComponent({
      name: 'FavouriteDetail',
      setup: () => () => h('div', { 'data-test': 'detail' }),
    })
    await nextTick()

    expect(wrapper.find('[data-test="detail"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="overview"]').exists()).toBe(false)
  })
})