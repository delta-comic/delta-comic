import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { nextTick } from 'vue'

vi.mock('@vueuse/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  const { shallowRef } = await import('vue')
  return { ...actual, useMediaQuery: () => shallowRef(true), useSupported: () => shallowRef(true) }
})

import DcPullRefresh from '../../../lib/components/DcPullRefresh.vue'

const touch = (type: string, x = 0, y = 0) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: type === 'touchend' || type === 'touchcancel' ? [] : [{ clientX: x, clientY: y }],
  })
  return event
}

afterEach(() => vi.useRealTimers())

describe('DcPullRefresh gesture state machine', () => {
  it('tracks a vertical pull and settles without refreshing below the threshold', async () => {
    vi.useFakeTimers()
    const refresher = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(DcPullRefresh, {
      props: { disabled: false, pullDistance: 60, refresher },
      slots: { default: () => 'comic list' },
    })
    const root = wrapper.get('div').element

    root.dispatchEvent(touch('touchstart', 20, 100))
    const move = touch('touchmove', 20, 160)
    root.dispatchEvent(move)
    await nextTick()

    expect(move.defaultPrevented).toBe(true)
    expect(wrapper.emitted('update:pulling')?.at(-1)).toEqual([true])
    expect((root.lastElementChild as HTMLElement).style.transform).toBe('translate3d(0, 27px, 0)')

    root.dispatchEvent(touch('touchend'))
    await nextTick()
    expect(refresher).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:pulling')?.at(-1)).toEqual([false])
    await vi.advanceTimersByTimeAsync(320)
  })

  it('ignores horizontal gestures and pulls when the container is scrolled', async () => {
    const wrapper = mount(DcPullRefresh, { props: { disabled: false, refresher: vi.fn() } })
    const root = wrapper.get('div').element

    root.dispatchEvent(touch('touchstart', 10, 100))
    const horizontal = touch('touchmove', 80, 120)
    root.dispatchEvent(horizontal)
    expect(horizontal.defaultPrevented).toBe(false)

    root.scrollTop = 10
    root.dispatchEvent(touch('touchstart', 0, 100))
    const scrolled = touch('touchmove', 0, 200)
    root.dispatchEvent(scrolled)
    await nextTick()
    expect(scrolled.defaultPrevented).toBe(false)
    expect(wrapper.emitted('update:pulling')).toBeUndefined()
  })

  it('refreshes after crossing the threshold and resets in finally', async () => {
    vi.useFakeTimers()
    const refresher = vi.fn().mockResolvedValue('fresh')
    const wrapper = mount(DcPullRefresh, {
      props: { disabled: false, pullDistance: 58, refresher },
    })
    const root = wrapper.get('div').element

    root.dispatchEvent(touch('touchstart', 5, 100))
    root.dispatchEvent(touch('touchmove', 5, 300))
    root.dispatchEvent(touch('touchend'))
    await nextTick()

    expect(wrapper.emitted('update:refreshing')?.at(0)).toEqual([true])
    expect(refresher).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(220)
    expect(refresher).toHaveBeenCalledOnce()
    expect(wrapper.emitted('update:refreshing')?.at(-1)).toEqual([false])
    expect(wrapper.emitted('update:pulling')?.at(-1)).toEqual([false])
    await vi.advanceTimersByTimeAsync(320)
  })

  it('caps rubber-band distance for extreme pulls', async () => {
    const wrapper = mount(DcPullRefresh, {
      props: { disabled: false, pullDistance: 50, refresher: vi.fn() },
    })
    const root = wrapper.get('div').element
    root.dispatchEvent(touch('touchstart', 0, 100))
    root.dispatchEvent(touch('touchmove', 0, 10_000))
    await nextTick()

    const transform = (root.lastElementChild as HTMLElement).style.transform
    expect(Number(transform.match(/0, ([\d.]+)px/)?.[1])).toBeCloseTo(110)
  })

  it('reflects externally controlled refreshing state and resets when disabled', async () => {
    const wrapper = mount(DcPullRefresh, {
      props: { disabled: false, refresher: vi.fn(), refreshing: false },
    })
    expect(wrapper.find('[aria-hidden="true"]').exists()).toBe(true)

    await wrapper.setProps({ refreshing: true })
    expect(wrapper.get('[aria-hidden="true"]').attributes('style')).toContain('height: 58px')

    await wrapper.setProps({ disabled: true })
    expect(wrapper.find('[aria-hidden="true"]').exists()).toBe(false)
    expect(wrapper.emitted('update:pulling')?.at(-1)).toEqual([false])
  })
})