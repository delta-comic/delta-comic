import { flushPromises, mount, shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h, nextTick } from 'vue'
// cspell:ignore borderless

import DcAwait from './DcAwait.vue'
import DcCell from './DcCell.vue'
import DcCellGroup from './DcCellGroup.vue'
import DcLoading from './DcLoading.vue'
import DcState from './DcState.vue'
import DcText from './DcText.vue'
import DcToggleIcon from './DcToggleIcon.vue'
import DcVar from './DcVar.vue'

const NSpinStub = defineComponent({
  inheritAttrs: false,
  props: ['contentClass', 'delay', 'show'],
  setup(props, { attrs, slots }) {
    return () =>
      h('section', { ...attrs, 'data-show': String(props.show) }, [
        slots.description?.(),
        slots.default?.(),
      ])
  },
})

describe('small UI contracts', () => {
  it('loads an async value automatically and exposes manual reload through the slot', async () => {
    const promise = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second')
    const wrapper = mount(DcAwait, {
      props: { autoLoad: true, promise },
      slots: {
        default: ({ load, result }: any) => h('button', { onClick: load }, result ?? 'pending'),
      },
    })

    expect(wrapper.text()).toBe('pending')
    await flushPromises()
    expect(wrapper.text()).toBe('first')

    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toBe('second')
    expect(promise).toHaveBeenCalledTimes(2)
  })

  it('passes values through a typed scoped slot', () => {
    const wrapper = mount(DcVar, {
      props: { value: { id: 7 } },
      slots: { default: ({ value }: any) => `comic-${value.id}` },
    })
    expect(wrapper.text()).toBe('comic-7')
  })

  it('normalizes spinner dimensions and only renders text when supplied', async () => {
    const wrapper = mount(DcLoading, {
      props: { color: 'red', size: 24, spinning: false, strokeWidth: 3, textSize: 12 },
    })

    expect(wrapper.get('svg').attributes()).toMatchObject({ height: '24px', width: '24px' })
    expect(wrapper.get('path').attributes('stroke-width')).toBe('3')
    expect(wrapper.get('svg').classes()).not.toContain('animate-spin')
    expect(wrapper.find('span').exists()).toBe(false)

    await wrapper.setProps({ size: '2rem', spinning: true, textSize: '1rem' })
    expect(wrapper.get('svg').attributes('width')).toBe('2rem')
    expect(wrapper.get('svg').classes()).toContain('animate-spin')

    const withText = mount(DcLoading, { slots: { default: () => 'Loading comic' } })
    expect(withText.get('span').text()).toBe('Loading comic')
    expect(withText.get('span').attributes('style')).toContain('font-size: 14px')
  })

  it('renders data while reflecting loading and error states', async () => {
    const state = { data: { count: 2 }, status: 'success' }
    const wrapper = shallowMount(DcState, {
      global: { stubs: { Spin: NSpinStub } },
      props: { state: state as any },
      slots: { default: ({ data }: any) => h('output', data ? String(data.count) : 'no data') },
    })

    expect(wrapper.get('section').attributes('data-show')).toBe('false')
    expect(wrapper.get('output').text()).toBe('2')

    await wrapper.setProps({
      state: { data: null, error: new Error('network down'), status: 'error' },
    })
    expect(wrapper.get('section').attributes('data-show')).toBe('true')
    expect(wrapper.text()).toContain('network down')
  })

  it('sanitizes markup and turns a leading URL into a safe external anchor', async () => {
    const wrapper = mount(DcText, { props: { text: '<img src=x onerror=alert(1)>' } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('<img')
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')

    await wrapper.setProps({ text: 'https://example.com/path' })
    const link = wrapper.get('a')
    expect(link.attributes('href')).toBe('https://example.com/path')
  })
})

describe('DcCell', () => {
  it('renders slot precedence, accessibility, modifiers, and router navigation', async () => {
    const push = vi.fn()
    const wrapper = mount(DcCell, {
      global: {
        plugins: [
          {
            install(app) {
              app.config.globalProperties.$router = { push, replace: vi.fn() } as any
            },
          },
        ],
      },
      props: {
        border: false,
        center: true,
        clickable: true,
        icon: 'book',
        iconPrefix: 'dc-',
        label: 'fallback label',
        required: true,
        size: 'large',
        title: 'fallback title',
        to: '/details',
        value: 'fallback value',
      },
      slots: {
        extra: () => h('i', { class: 'extra' }, 'extra'),
        label: () => 'slot label',
        title: () => 'slot title',
        value: () => 'slot value',
      },
    })

    expect(wrapper.classes()).toEqual(
      expect.arrayContaining([
        'dc-cell--borderless',
        'dc-cell--center',
        'dc-cell--clickable',
        'dc-cell--large',
        'dc-cell--required',
      ]),
    )
    expect(wrapper.attributes()).toMatchObject({ role: 'button', tabindex: '0' })
    expect(wrapper.text()).toContain('slot title')
    expect(wrapper.text()).toContain('slot label')
    expect(wrapper.text()).toContain('slot value')
    expect(wrapper.find('.extra').exists()).toBe(true)
    expect(wrapper.find('.dc-cell__icon').classes()).toEqual(
      expect.arrayContaining(['dc-', 'book']),
    )

    await wrapper.trigger('click')
    expect(push).toHaveBeenCalledWith('/details')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it.each([
    [undefined, '›'],
    ['right', '›'],
    ['left', '‹'],
    ['up', '⌃'],
    ['down', '⌄'],
  ] as const)('renders the %s link arrow', (arrowDirection, arrow) => {
    const wrapper = mount(DcCell, { props: { arrowDirection, isLink: true } })
    expect(wrapper.get('.dc-cell__arrow').text()).toBe(arrow)
  })

  it('prefers the right-icon slot over the generated arrow', () => {
    const wrapper = mount(DcCell, {
      props: { isLink: true },
      slots: { 'right-icon': () => h('span', { class: 'custom-arrow' }, 'custom') },
    })
    expect(wrapper.get('.custom-arrow').text()).toBe('custom')
    expect(wrapper.find('.dc-cell__arrow').exists()).toBe(false)
  })
})

describe('DcCellGroup', () => {
  it('forwards root attributes and conditionally renders title and border classes', () => {
    const wrapper = mount(DcCellGroup, {
      attrs: { id: 'settings-group' },
      props: { border: true, inset: false, title: 'Settings' },
      slots: { default: () => 'content' },
    })
    expect(wrapper.attributes('id')).toBe('settings-group')
    expect(wrapper.get('.dc-cell-group__title').text()).toBe('Settings')
    expect(wrapper.get('.dc-cell-group').classes()).toContain('dc-hairline-top-bottom')
  })

  it('uses the named title slot and inset layout', () => {
    const wrapper = mount(DcCellGroup, {
      props: { border: true, inset: true },
      slots: { default: () => 'content', title: () => 'Slot title' },
    })
    expect(wrapper.get('.dc-cell-group__title').text()).toBe('Slot title')
    expect(wrapper.get('.dc-cell-group__title').classes()).toContain('dc-cell-group__title--inset')
    expect(wrapper.get('.dc-cell-group').classes()).toContain('dc-cell-group--inset')
    expect(wrapper.get('.dc-cell-group').classes()).not.toContain('dc-hairline-top-bottom')
  })
})

describe('DcToggleIcon', () => {
  const Icon = defineComponent(() => () => h('svg'))

  it('emits intent, updates its model, and reports the resulting state', async () => {
    const wrapper = shallowMount(DcToggleIcon, {
      global: {
        stubs: {
          NIcon: defineComponent(
            (_, { slots }) =>
              () =>
                h('i', slots.default?.()),
          ),
        },
      },
      props: { icon: Icon, modelValue: false },
      slots: { default: () => 'Favorite' },
    })

    await wrapper.trigger('click')
    await nextTick()
    expect(wrapper.emitted('click')).toEqual([[true]])
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
    expect(wrapper.emitted('change')).toEqual([[true]])
    expect(wrapper.text()).toContain('Favorite')
  })

  it('can emit click intent without mutating the controlled state', async () => {
    const wrapper = shallowMount(DcToggleIcon, {
      props: { disChanged: true, icon: Icon, modelValue: true },
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toEqual([[false]])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})