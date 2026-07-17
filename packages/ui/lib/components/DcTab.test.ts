import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

// cspell:ignore vnode

const swiper = vi.hoisted(() => ({ slideTo: vi.fn(), touches: { diff: 0 }, update: vi.fn() }))

vi.mock('swiper/modules', () => ({ FreeMode: Symbol('FreeMode') }))
vi.mock('swiper/vue', async () => {
  const { defineComponent, h, onMounted } = await import('vue')
  const Swiper = defineComponent({
    name: 'Swiper',
    props: ['freeMode', 'modules', 'slidesPerView', 'watchSlidesProgress'],
    emits: ['resize', 'set-translate', 'swiper', 'transition-end'],
    setup(_, { attrs, emit, expose, slots }) {
      expose({ touchEnd: () => (attrs as any).onTouchEnd?.(swiper) })
      onMounted(() => emit('swiper', swiper))
      return () => h('div', { class: 'swiper-stub' }, slots.default?.())
    },
  })
  const SwiperSlide = defineComponent({
    name: 'SwiperSlide',
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () =>
        h('div', { ...attrs, class: ['swiper-slide-stub', attrs.class] }, slots.default?.())
    },
  })
  return { Swiper, SwiperSlide }
})

import DcTab from './DcTab.vue'

beforeEach(() => {
  swiper.slideTo.mockReset()
  swiper.update.mockReset()
  swiper.touches.diff = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
})

afterEach(() => vi.unstubAllGlobals())

const setupRouter = async (path = '/a') => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { component: { template: '<div />' }, name: 'a', path: '/a' },
      { component: { template: '<div />' }, name: 'b', path: '/b' },
    ],
  }) as any
  router.force = {
    push: vi.fn().mockResolvedValue(undefined),
    replace: vi.fn().mockResolvedValue(undefined),
  }
  await router.push(path)
  return router
}

const items = [
  { name: 'a', route: { name: 'a' }, title: 'Alpha' },
  { name: 'b', route: { name: 'b' }, title: 'Beta' },
]

describe('DcTab', () => {
  it('derives selection from the route and uses forced replacement by default', async () => {
    const router = await setupRouter('/b')
    const wrapper = mount(DcTab, {
      global: { plugins: [router] },
      props: { items: items as any },
      slots: { bottom: () => 'bottom', left: () => 'left', right: () => 'right' },
    })
    await flushPromises()

    expect(wrapper.get('.dc-tabs__nav').classes()).toEqual(
      expect.arrayContaining(['flex', 'h-[var(--dc-tabs-height,44px)]', 'bg-(--dc-color-surface)']),
    )
    expect(wrapper.findAll('.dc-tabs__tab')[1].classes()).toEqual(
      expect.arrayContaining(['dc-tabs__tab--active', 'cursor-pointer', 'touch-manipulation']),
    )
    expect(wrapper.findAll('.dc-tabs__tab-text')[1].classes()).toEqual(
      expect.arrayContaining([
        'font-medium',
        'text-(--dc-color-text)',
        'transition-[color,font-weight]',
      ]),
    )
    expect(wrapper.get('.dc-tabs__indicator').classes()).toEqual(
      expect.arrayContaining([
        'absolute',
        'bg-[var(--dc-tabs-indicator-color,var(--dc-color-primary))]',
        'transition-[transform,width]',
      ]),
    )
    expect(wrapper.findAll('.dc-tabs__slide')[0].classes()).toEqual(
      expect.arrayContaining(['flex!', 'w-auto!']),
    )
    expect(swiper.slideTo).toHaveBeenCalledWith(1)
    expect(wrapper.text()).toContain('left')
    expect(wrapper.text()).toContain('right')
    expect(wrapper.text()).toContain('bottom')

    await wrapper.findAll('.dc-tabs__tab')[0].trigger('click')
    expect(router.force.replace).toHaveBeenCalledWith({ name: 'a' })
  })

  it('updates v-model without navigation in controlled mode', async () => {
    const router = await setupRouter()
    const wrapper = mount(DcTab, {
      global: { plugins: [router] },
      props: {
        items: items.map(({ route: _route, ...item }) => item),
        modelValue: 'missing',
        router: false,
      },
    })
    expect(wrapper.findAll('.dc-tabs__tab')[0].classes()).toContain('dc-tabs__tab--active')

    await wrapper.findAll('.dc-tabs__tab')[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])
    expect(router.force.replace).not.toHaveBeenCalled()
  })

  it('uses push mode and suppresses concurrent route changes with its mutex', async () => {
    const router = await setupRouter()
    let release!: () => void
    router.force.push.mockReturnValue(
      new Promise<void>(resolve => {
        release = resolve
      }),
    )
    const wrapper = mount(DcTab, {
      global: { plugins: [router] },
      props: { items: items as any, mode: 'push' },
    })

    await wrapper.findAll('.dc-tabs__tab')[1].trigger('click')
    await wrapper.findAll('.dc-tabs__tab')[1].trigger('click')
    expect(router.force.push).toHaveBeenCalledOnce()
    release()
    await flushPromises()
  })

  it('switches adjacent tabs with a sufficiently large swipe', async () => {
    const router = await setupRouter()
    const wrapper = mount(DcTab, {
      global: { plugins: [router] },
      props: {
        items: items.map(({ route: _route, ...item }) => item),
        router: false,
        swipeable: true,
      },
    })
    swiper.touches.diff = -80
    ;(wrapper.getComponent({ name: 'Swiper' }).vm.$.vnode.props as any).onTouchEnd(swiper)
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])

    await wrapper.setProps({ modelValue: 'b' })
    swiper.touches.diff = 80
    ;(wrapper.getComponent({ name: 'Swiper' }).vm.$.vnode.props as any).onTouchEnd(swiper)
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['a'])
  })

  it('ignores short/disabled swipes and updates Swiper when items change', async () => {
    const router = await setupRouter()
    const wrapper = mount(DcTab, {
      global: { plugins: [router] },
      props: {
        items: items.map(({ route: _route, ...item }) => item),
        router: false,
        swipeable: false,
      },
    })
    swiper.touches.diff = -100
    ;(wrapper.getComponent({ name: 'Swiper' }).vm.$.vnode.props as any).onTouchEnd(swiper)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await wrapper.setProps({
      items: [...items.map(({ route: _route, ...item }) => item), { name: 'c', title: 'Gamma' }],
    })
    await nextTick()
    expect(swiper.update).toHaveBeenCalledOnce()
  })
})