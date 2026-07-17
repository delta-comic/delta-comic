import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h, nextTick, shallowRef } from 'vue'

vi.mock('@lhlyu/vue-virtual-waterfall', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    VirtualWaterfall: defineComponent({
      name: 'VirtualWaterfall',
      props: ['calcItemHeight', 'gap', 'items', 'maxColumnCount', 'minColumnCount', 'padding'],
      setup(props, { slots }) {
        return () =>
          h(
            'div',
            { class: 'virtual-waterfall' },
            (props.items as object[]).map((item, index) =>
              h('div', { 'data-index': index }, slots.default?.({ index, item })),
            ),
          )
      },
    }),
  }
})

import DcList from './DcList.vue'
import DcWaterfall from './DcWaterfall.vue'

let resizeCallback: ResizeObserverCallback
const resizeObserve = vi.fn()
const resizeDisconnect = vi.fn()
const mutationDisconnect = vi.fn()

class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback
  }
  disconnect = resizeDisconnect
  observe = resizeObserve
  unobserve = vi.fn()
}

class MutationObserverMock {
  constructor(_callback: MutationCallback) {}
  disconnect = mutationDisconnect
  observe = vi.fn()
  takeRecords = () => []
}

const ContentStub = defineComponent({
  name: 'DcContent',
  props: ['source'],
  setup(props, { expose, slots }) {
    const cont = shallowRef<HTMLElement>()
    expose({ cont })
    return () =>
      h(
        'div',
        { class: 'content-stub', ref: cont },
        slots.default?.({ data: (props.source as any).data }),
      )
  },
})

const PullRefreshStub = defineComponent({
  name: 'DcPullRefresh',
  props: ['disabled', 'refresher'],
  setup(_, { slots }) {
    return () => h('section', { class: 'pull-refresh-stub' }, slots.default?.())
  },
})

const global = { stubs: { DcContent: ContentStub, DcPullRefresh: PullRefreshStub } }

beforeEach(() => {
  resizeObserve.mockReset()
  resizeDisconnect.mockReset()
  mutationDisconnect.mockReset()
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  vi.stubGlobal('MutationObserver', MutationObserverMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('DcWaterfall', () => {
  it('maps array data into columns and forwards a rich item slot contract', async () => {
    const items = [{ id: 1 }, { id: 2 }]
    const wrapper = mount(DcWaterfall, {
      global,
      props: {
        col: [2, 4],
        gap: 8,
        minHeight: 40,
        padding: 6,
        source: { type: 'array', value: items },
      },
      slots: {
        default: ({ height, index, item, length, minHeight }: any) =>
          h(
            'article',
            { 'class': 'item', 'data-height': height, 'data-index': index },
            `${item.id}/${length}/${minHeight}`,
          ),
      },
    })
    await nextTick()
    const virtual = wrapper.getComponent({ name: 'VirtualWaterfall' })

    expect(virtual.props()).toMatchObject({
      gap: 8,
      items,
      maxColumnCount: 4,
      minColumnCount: 2,
      padding: 6,
    })
    expect(wrapper.findAll('.item').map(item => item.text())).toEqual(['1/2/40', '2/2/40'])
    expect(resizeObserve).toHaveBeenCalledTimes(2)
  })

  it('forwards the reload gesture preference to the pull-refresh container', async () => {
    const wrapper = mount(DcWaterfall, {
      global,
      props: { source: { type: 'array', value: [{ id: 1 }] }, unReloadable: true },
    })
    await nextTick()

    expect(wrapper.getComponent(PullRefreshStub).props('disabled')).toBe(true)
  })

  it('records observed item heights and clears them on reload', async () => {
    const item = { id: 1 }
    const wrapper = mount(DcWaterfall, {
      global,
      props: { minHeight: 30, source: { type: 'array', value: [item] } },
      slots: {
        default: ({ height }: any) => h('article', { class: 'measured' }, String(height ?? 'none')),
      },
    })
    await nextTick()
    const target = resizeObserve.mock.calls[0][0] as HTMLElement
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ height: 96 } as DOMRect)
    resizeCallback([{ target } as unknown as ResizeObserverEntry], {} as ResizeObserver)
    await nextTick()
    expect(wrapper.get('.measured').text()).toBe('96')

    await (wrapper.vm as any).reloadList()
    expect(wrapper.get('.measured').text()).toBe('none')
  })

  it('loads or fetches again near the bottom after the scroll throttle', async () => {
    vi.useFakeTimers()
    const next = vi.fn()
    const refetch = vi.fn()
    const error = shallowRef<Error | null>(null)
    const wrapper = mount(DcWaterfall, {
      global,
      props: {
        source: {
          type: 'infinite',
          value: {
            data: shallowRef({ pages: [[{ id: 1 }]] }),
            error,
            hasNextPage: shallowRef(true),
            isLoading: shallowRef(false),
            loadNextPage: next,
            refetch,
            refresh: vi.fn(),
          } as any,
        },
      },
    })
    await nextTick()
    const content = wrapper.get('.content-stub').element as HTMLElement
    Object.defineProperties(content, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, value: 350, writable: true },
    })

    content.dispatchEvent(new Event('scroll'))
    content.dispatchEvent(new Event('scroll'))
    await vi.advanceTimersByTimeAsync(200)
    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith({ cancelRefetch: true })

    error.value = new Error('stale page')
    content.dispatchEvent(new Event('scroll'))
    await vi.advanceTimersByTimeAsync(200)
    expect(refetch).toHaveBeenCalledWith(false)
  })

  it('does not load when complete, loading, far from the bottom, or missing a container', async () => {
    vi.useFakeTimers()
    const next = vi.fn()
    const hasNextPage = shallowRef(false)
    const isLoading = shallowRef(false)
    const wrapper = mount(DcWaterfall, {
      global,
      props: {
        source: {
          type: 'infinite',
          value: {
            data: shallowRef({ pages: [[{ id: 1 }]] }),
            error: shallowRef(null),
            hasNextPage,
            isLoading,
            loadNextPage: next,
            refetch: vi.fn(),
            refresh: vi.fn(),
          } as any,
        },
      },
    })
    await nextTick()
    const content = wrapper.get('.content-stub').element as HTMLElement
    Object.defineProperties(content, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 1_000 },
      scrollTop: { configurable: true, value: 0, writable: true },
    })
    content.dispatchEvent(new Event('scroll'))
    await vi.advanceTimersByTimeAsync(200)
    expect(next).not.toHaveBeenCalled()

    hasNextPage.value = true
    isLoading.value = true
    content.scrollTop = 950
    content.dispatchEvent(new Event('scroll'))
    await vi.advanceTimersByTimeAsync(200)
    expect(next).not.toHaveBeenCalled()
  })

  it('disconnects observers and pending throttle work on unmount', async () => {
    vi.useFakeTimers()
    const wrapper = mount(DcWaterfall, {
      global,
      props: { source: { type: 'array', value: [{ id: 1 }] } },
    })
    await nextTick()
    wrapper.get('.content-stub').element.dispatchEvent(new Event('scroll'))
    wrapper.unmount()
    expect(resizeDisconnect).toHaveBeenCalledOnce()
    expect(mutationDisconnect).toHaveBeenCalledOnce()
  })
})

describe('DcList', () => {
  it('pins waterfall layout to one column and forwards exposed controls', async () => {
    const reloadList = vi.fn().mockResolvedValue(undefined)
    const WaterfallStub = defineComponent({
      name: 'DcWaterfall',
      props: ['col', 'gap', 'minHeight', 'padding', 'source', 'unReloadable'],
      setup(_, { expose, slots }) {
        const scrollParent = document.createElement('div')
        expose({ reloadList, scrollParent, scrollTop: 42 })
        return () =>
          h(
            'div',
            slots.default?.({ height: 80, index: 0, item: { id: 1 }, length: 1, minHeight: 20 }),
          )
      },
    })
    const wrapper = mount(DcList, {
      global: { stubs: { DcWaterfall: WaterfallStub } },
      props: { minHeight: 20, source: { type: 'array', value: [{ id: 1 }] } },
      slots: { default: ({ item, length }: any) => `${item.id}/${length}` },
    })
    expect(wrapper.getComponent(WaterfallStub).props()).toMatchObject({
      col: 1,
      gap: 0,
      padding: 0,
    })
    expect(wrapper.text()).toBe('1/1')
    expect((wrapper.vm as any).scrollTop).toBe(42)
    expect((wrapper.vm as any).scrollParent).toBeInstanceOf(HTMLElement)
    await (wrapper.vm as any).reloadList()
    expect(reloadList).toHaveBeenCalledOnce()
  })
})