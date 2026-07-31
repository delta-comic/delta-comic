import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { SetupContext } from 'vue'

const { barcode, history, preventBackRefs, routeCall } = await vi.hoisted(async () => {
  // @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
  await import('../../../public/runtime/host-libraries.umd.js')
  const vueRuntimePath = '../../../node_modules/vue/dist/vue.esm-bundler.js'
  const Vue = (await import(/* @vite-ignore */ vueRuntimePath)) as typeof import('vue')
  window.$$lib$$ = { ...window.$$lib$$, Vue } as typeof window.$$lib$$
  return {
    barcode: vi.fn(),
    history: Vue.shallowRef<string[]>([]),
    preventBackRefs: [] as Array<{ value: boolean }>,
    routeCall: vi.fn(),
  }
})

await vi.hoisted(async () => {
  const { defineComponent, h } = window.$$lib$$.Vue
  const passthrough = (name: string, tag = 'div') =>
    defineComponent({
      name,
      setup:
        (_props: Record<string, never>, { attrs, slots }: SetupContext) =>
        () =>
          h(tag, attrs, slots.default?.()),
    })
  window.$$lib$$.Naive = { ...window.$$lib$$.Naive, NIcon: passthrough('NIcon', 'span') }
})

vi.mock('@delta-comic/db', () => ({ useNativeStore: () => history }))
vi.mock('@delta-comic/ui', () => {
  const { defineComponent, h } = window.$$lib$$.Vue
  return {
    DcCell: defineComponent({
      name: 'DcCell',
      inheritAttrs: false,
      props: { title: String },
      emits: ['click'],
      setup:
        (props: { title?: string }, { emit }: SetupContext) =>
        () =>
          h(
            'button',
            { class: 'dc-cell', onClick: () => emit('click'), type: 'button' },
            props.title,
          ),
    }),
    DcCellGroup: defineComponent({
      name: 'DcCellGroup',
      setup:
        (_props: Record<string, never>, { slots }: SetupContext) =>
        () =>
          h('section', slots.default?.()),
    }),
    usePreventBack: (state: { value: boolean }) => preventBackRefs.push(state),
  }
})
vi.mock('@delta-comic/utils', () => ({
  ReuseableAbortController: class ReuseableAbortController {
    private controller = new AbortController()
    get signal() {
      return this.controller.signal
    }
    abort() {
      this.controller.abort()
      this.controller = new AbortController()
    }
  },
  SharedFunction: { call: routeCall },
}))
vi.mock('@vueuse/core', () => ({
  computedAsync: <T>(
    getter: (onCancel: (callback: () => void) => void) => Promise<T>,
    initial: T,
  ) => {
    const state = window.$$lib$$.Vue.shallowRef(initial)
    void getter(() => undefined).then(value => (state.value = value))
    return state
  },
}))
vi.mock('motion-v', () => {
  const { defineComponent, h } = window.$$lib$$.Vue
  const passthrough = (name: string) =>
    defineComponent({
      name,
      inheritAttrs: false,
      setup:
        (_props: Record<string, never>, { attrs, slots }: SetupContext) =>
        () =>
          h('div', attrs, slots.default?.()),
    })
  const Motion = passthrough('Motion')
  return {
    AnimatePresence: passthrough('AnimatePresence'),
    Motion,
    motion: { div: passthrough('MotionDiv') },
  }
})
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/icons', () => ({ Icons: { material: { CloseRound: {}, SearchFilled: {} } } }))
vi.mock('@/utils/search', () => ({ getBarcodeList: barcode }))

import MainPageSearchBar from '../../../src/components/home/mainPageSearchBar.vue'
import ListSearcher from '../../../src/components/listSearcher.vue'

describe('ListSearcher', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    preventBackRefs.length = 0
  })

  afterEach(() => wrapper?.unmount())

  it('opens on focus and deduplicates non-empty history on blur', async () => {
    wrapper = mount(ListSearcher, { props: { filtersHistory: ['alpha', 'older'] } })
    const input = wrapper.get('input[type="search"]')

    await input.trigger('focus')
    expect(preventBackRefs[0]?.value).toBe(true)

    await input.setValue('alpha')
    await input.trigger('blur')
    expect(wrapper.emitted('update:filtersHistory')).toEqual([[['alpha', 'older']]])
  })

  it('clears both text and the active search panel through its accessible action', async () => {
    wrapper = mount(ListSearcher, { props: { filtersHistory: [] } })
    const input = wrapper.get('input[type="search"]')
    await input.trigger('focus')
    await input.setValue('temporary')

    await wrapper.get('button[aria-label="search.actions.clear"]').trigger('click')

    expect((wrapper.vm as unknown as { searchText: string }).searchText).toBe('')
    expect(preventBackRefs[0]?.value).toBe(false)
  })
})

describe('MainPageSearchBar', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    routeCall.mockReset()
  })

  afterEach(() => wrapper?.unmount())

  it('acts as a route trigger instead of opening an in-place search panel', async () => {
    wrapper = mount(MainPageSearchBar)

    await wrapper.get('button[aria-label="search.actions.open"]').trigger('click')

    expect(wrapper.emitted('activate')).toEqual([[]])
    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('uses the translated search placeholder as its visible label', () => {
    wrapper = mount(MainPageSearchBar)

    expect(wrapper.text()).toContain('search.placeholder.short')
  })
})