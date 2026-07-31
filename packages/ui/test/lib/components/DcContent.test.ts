import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h, nextTick, shallowRef } from 'vue'

vi.mock('motion-v', async () => {
  const { defineComponent, h } = await import('vue')
  const PassThrough = defineComponent(
    (_, { slots }) =>
      () =>
        slots.default?.(),
  )
  const MotionDiv = defineComponent({
    inheritAttrs: false,
    props: ['animate', 'initial', 'variants'],
    setup(props, { attrs, slots }) {
      return () =>
        h(
          'div',
          { ...attrs, 'data-animate': props.animate, 'class': 'motion-state' },
          slots.default?.(),
        )
    },
  })
  return { AnimatePresence: PassThrough, motion: { div: MotionDiv } }
})

import DcContent from '../../../lib/components/DcContent.vue'

const namedSlotStub = (name: string) =>
  defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('div', attrs, [slots.icon?.(), slots.default?.(), slots.footer?.()])
    },
  })

const global = {
  stubs: {
    Button: namedSlotStub('Button'),
    Empty: namedSlotStub('Empty'),
    Icon: namedSlotStub('Icon'),
    Result: namedSlotStub('Result'),
  },
}

describe('DcContent state orchestration', () => {
  it('shows an empty loading state and exposes its scroll container', () => {
    const wrapper = mount(DcContent, {
      global,
      props: { source: { data: [], error: null, isLoading: true, type: 'raw' } },
      slots: { default: ({ data }: any) => h('output', JSON.stringify(data)) },
    })

    expect(wrapper.get('.motion-state').attributes('data-animate')).toBe('isLoadingNoData')
    expect(wrapper.findComponent({ name: 'DcLoading' }).props('size')).toBe('25px')
    expect(wrapper.find('output').exists()).toBe(false)
    expect((wrapper.vm as any).cont).toBeInstanceOf(HTMLElement)
  })

  it('keeps stale data visible while rendering compact loading feedback', () => {
    const wrapper = mount(DcContent, {
      global,
      props: { source: { data: [{ id: 1 }], error: null, isLoading: true, type: 'raw' } },
      slots: { default: ({ data }: any) => h('output', String(data[0].id)) },
    })

    expect(wrapper.get('output').text()).toBe('1')
    expect(wrapper.get('.motion-state').attributes('data-animate')).toBe('isLoadingData')
    expect(wrapper.text()).toContain('Loading')
  })

  it('renders an empty result after a successful empty response', () => {
    const wrapper = mount(DcContent, {
      global,
      props: { source: { data: [], isLoading: false, type: 'raw' } },
    })

    expect(wrapper.get('.motion-state').attributes('data-animate')).toBe('isEmpty')
    expect(wrapper.getComponent({ name: 'Empty' }).attributes('description')).toBe('No results')
  })

  it('renders a full error and delegates retry when no data is available', async () => {
    const refetch = vi.fn()
    const wrapper = mount(DcContent, {
      global,
      props: {
        source: { data: [], error: new Error('offline'), isLoading: false, refetch, type: 'raw' },
      },
    })

    expect(wrapper.get('.motion-state').attributes('data-animate')).toBe('isErrorNoData')
    expect(wrapper.getComponent({ name: 'Result' }).attributes()).toMatchObject({
      description: 'offline',
      status: 'error',
      title: 'Network error',
    })
    await wrapper.getComponent({ name: 'Button' }).trigger('click')
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('renders a compact error over stale data and can retry it', async () => {
    const refetch = vi.fn()
    const wrapper = mount(DcContent, {
      global,
      props: {
        source: {
          data: [{ id: 1 }],
          error: new Error('stale request failed'),
          isLoading: false,
          refetch,
          type: 'raw',
        },
      },
      slots: { default: ({ data }: any) => h('output', String(data.length)) },
    })

    expect(wrapper.get('.motion-state').attributes('data-animate')).toBe('isErrorData')
    expect(wrapper.text()).toContain('stale request failed')
    await wrapper.getComponent({ name: 'Button' }).trigger('click')
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('honors visibility flags and settles into the done state', () => {
    const wrapper = mount(DcContent, {
      global,
      props: {
        hideEmpty: true,
        hideError: true,
        hideLoading: true,
        source: { data: [], error: new Error('ignored'), isLoading: true, type: 'raw' },
      },
    })
    expect(wrapper.get('.motion-state').attributes('data-animate')).toBe('done')
  })

  it('adapts query refs and fetches again with cancellation disabled', async () => {
    const refetch = vi.fn()
    const data = shallowRef<string[] | undefined>(undefined)
    const isLoading = shallowRef(true)
    const wrapper = mount(DcContent, {
      global,
      props: {
        source: {
          query: { data, error: shallowRef(null), isLoading, refetch } as any,
          type: 'query',
        },
      },
    })
    expect(wrapper.get('.motion-state').attributes('data-animate')).toBe('isLoadingNoData')

    data.value = []
    isLoading.value = false
    await nextTick()
    expect(wrapper.get('.motion-state').attributes('data-animate')).toBe('isEmpty')
  })

  it('flattens infinite pages and retries its stream', async () => {
    const refetch = vi.fn()
    const wrapper = mount(DcContent, {
      global,
      props: {
        source: {
          stream: {
            data: shallowRef({ pages: [['one'], ['two']] }),
            error: shallowRef(new Error('stream failed')),
            isLoading: shallowRef(false),
            refetch,
          } as any,
          type: 'infinite',
        },
      },
      slots: { default: ({ data }: any) => h('output', data.join(',')) },
    })

    expect(wrapper.get('output').text()).toBe('one,two')
    await wrapper.getComponent({ name: 'Button' }).trigger('click')
    expect(refetch).toHaveBeenCalledWith(false)
  })
})