import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { h, nextTick } from 'vue'

import DcVirtualWaterfall from '../../../lib/components/DcVirtualWaterfall.vue'

class ResizeObserverMock {
  disconnect = vi.fn()
  observe = vi.fn()
  unobserve = vi.fn()
}

function defineSize(element: HTMLElement, size: { width: number; height: number }) {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: size.height },
    clientWidth: { configurable: true, value: size.width },
    scrollTop: { configurable: true, value: 0, writable: true },
  })
}

function renderedIndexes(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[data-index]').map(item => Number(item.attributes('data-index')))
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('DcVirtualWaterfall', () => {
  it('uses only its internal scroll container to calculate visible items', async () => {
    const outerScroller = document.createElement('div')
    const componentScroller = document.createElement('div')
    defineSize(outerScroller, { width: 300, height: 200 })
    defineSize(componentScroller, { width: 300, height: 100 })
    outerScroller.append(componentScroller)
    document.body.append(outerScroller)

    const wrapper = mount(DcVirtualWaterfall, {
      attachTo: componentScroller,
      props: {
        calcItemHeight: () => 50,
        gap: 0,
        items: Array.from({ length: 10 }, (_, id) => ({ id })),
        maxColumnCount: 1,
        minColumnCount: 1,
        padding: 0,
        preloadScreenCount: [0, 0],
        scrollParent: componentScroller,
      },
      slots: { default: ({ item }: any) => h('article', String(item.id)) },
    })
    await nextTick()

    expect(renderedIndexes(wrapper)).toEqual([0, 1])

    componentScroller.scrollTop = 100
    componentScroller.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(renderedIndexes(wrapper)).toEqual([2, 3])

    outerScroller.scrollTop = 500
    outerScroller.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(renderedIndexes(wrapper)).toEqual([2, 3])
  })

  it('lays out variable-height items in the shortest available column', async () => {
    const componentScroller = document.createElement('div')
    defineSize(componentScroller, { width: 460, height: 500 })
    document.body.append(componentScroller)
    const items = [
      { id: 1, height: 100 },
      { id: 2, height: 50 },
      { id: 3, height: 80 },
    ]

    const wrapper = mount(DcVirtualWaterfall, {
      attachTo: componentScroller,
      props: {
        calcItemHeight: item => (item as { height: number }).height,
        gap: 10,
        items,
        itemMinWidth: 220,
        maxColumnCount: 2,
        minColumnCount: 1,
        padding: 5,
        preloadScreenCount: [0, 0],
        scrollParent: componentScroller,
      },
      slots: { default: ({ item }: any) => h('article', String(item.id)) },
    })
    await nextTick()

    const children = wrapper.findAll('[data-index]')
    expect(children).toHaveLength(3)
    expect(children.map(item => item.attributes('style'))).toEqual([
      expect.stringContaining('translate3d(5px, 5px, 0)'),
      expect.stringContaining('translate3d(235px, 5px, 0)'),
      expect.stringContaining('translate3d(235px, 65px, 0)'),
    ])
    expect(wrapper.attributes('style')).toContain('height: 150px')
  })
})