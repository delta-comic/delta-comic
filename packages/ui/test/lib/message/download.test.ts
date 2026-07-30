import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h, nextTick, type VNode } from 'vue'

vi.mock('@delta-comic/utils', () => ({ useGlobalVar: (value: unknown) => value }))
vi.mock('motion-v', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    motion: {
      div: defineComponent({
        name: 'MotionDiv',
        inheritAttrs: false,
        emits: ['dragEnd'],
        setup(_, { attrs, slots }) {
          return () => h('div', { ...attrs, class: 'motion-message' }, slots.default?.())
        },
      }),
    },
  }
})

import { createDownloadMessage } from '../../../lib/message/download'

const ButtonStub = defineComponent({
  name: 'Button',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h('button', attrs, [slots.icon?.(), slots.default?.()])
  },
})

const PassThrough = (name: string) =>
  defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('div', attrs, slots.default?.())
    },
  })

const global = {
  stubs: {
    Button: ButtonStub,
    Icon: PassThrough('Icon'),
    IconWrapper: PassThrough('IconWrapper'),
    Progress: PassThrough('Progress'),
  },
}

let renderMessage: ((props: { content: string }) => VNode) | undefined
let destroy: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  renderMessage = undefined
  destroy = vi.fn()
  Object.assign(window, {
    $message: {
      create: vi.fn((_title: string, options: any) => {
        renderMessage = options.render
        return { destroy }
      }),
    },
  })
})

afterEach(() => vi.useRealTimers())

const mountRenderedMessage = () => {
  if (!renderMessage) throw new Error('message render function was not registered')
  return mount(
    defineComponent(() => () => renderMessage!({ content: 'Download' })),
    { global },
  )
}

describe('createDownloadMessage', () => {
  it('tracks loading and progress work and resolves the aggregate result', async () => {
    const task = createDownloadMessage('Download', async bind => {
      const loading = await bind.createLoading('Metadata', async state => {
        state.description = 'Loaded manifest'
        return 'metadata'
      })
      const progress = await bind.createProgress('Pages', async state => {
        state.description = '3 / 10'
        state.progress = 30
        return 'pages'
      })
      return { loading, progress }
    })

    await expect(task).resolves.toEqual({ loading: 'metadata', progress: 'pages' })
    const wrapper = mountRenderedMessage()
    expect(wrapper.text()).toContain('Metadata')
    expect(wrapper.text()).toContain('Loaded manifest')
    expect(wrapper.text()).toContain('Pages')
    expect(wrapper.text()).toContain('3 / 10')
    expect(wrapper.findAllComponents({ name: 'Progress' }).at(-1)?.attributes('percentage')).toBe(
      '30',
    )

    await vi.advanceTimersByTimeAsync(3_000)
    await nextTick()
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('keeps retryable failures pending until the user retries', async () => {
    let attempt = 0
    const task = createDownloadMessage('Retry download', async bind =>
      bind.createLoading('Plugin package', async state => {
        attempt++
        if (attempt === 1) {
          state.retryable = true
          throw new Error('temporary outage')
        }
        state.description = 'Recovered'
        return 'installed'
      }),
    )
    const assertion = expect(task).resolves.toBe('installed')
    await vi.waitFor(() => expect(renderMessage).toBeTypeOf('function'))
    const wrapper = mountRenderedMessage()
    await vi.waitFor(() => expect(wrapper.text()).toContain('temporary outage'))
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)

    await buttons[1].trigger('click')
    await assertion
    expect(attempt).toBe(2)
    expect(wrapper.text()).toContain('Recovered')
  })
})