import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { shallowRef } from 'vue'

const { dialog, memory, message, pluginRuntime } = vi.hoisted(() => ({
  dialog: { info: vi.fn() },
  memory: { clear: vi.fn(), read: vi.fn(), remember: vi.fn() },
  message: { error: vi.fn(), warning: vi.fn() },
  pluginRuntime: {
    activeNormalPluginNames: [] as string[],
    loadNormal: vi.fn(),
    reloadNormal: vi.fn(),
  },
}))

await vi.hoisted(async () => {
  const vueRuntimePath = '../../../../node_modules/vue/dist/vue.esm-bundler.js'
  const Vue = (await import(/* @vite-ignore */ vueRuntimePath)) as typeof import('vue')
  const { defineComponent, h } = Vue
  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup:
        (_props, { slots }) =>
        () =>
          h('div', slots.default?.()),
    })
  const Spin = defineComponent({
    name: 'NSpin',
    setup:
      (_props, { slots }) =>
      () =>
        h('section', [slots.default?.(), h('aside', slots.description?.())]),
  })
  window.$$lib$$ = {
    ...window.$$lib$$,
    Naive: {
      NDrawer: passthrough('NDrawer'),
      NIcon: passthrough('NIcon'),
      NMenu: passthrough('NMenu'),
      NSpin: Spin,
      NTabPane: passthrough('NTabPane'),
      NTabs: passthrough('NTabs'),
      useDialog: () => dialog,
      useMessage: () => message,
    },
    Vue,
  } as typeof window.$$lib$$
})

vi.mock('@delta-comic/plugin', () => ({ pluginRuntime }))
vi.mock('@/features/pluginStartup/PluginStartupMemory', () => ({ pluginStartupMemory: memory }))
vi.mock('@/icons', () => ({
  Icons: {
    antd: { SafetyOutlined: {} },
    material: {
      AutoAwesomeMosaicOutlined: {},
      CheckRound: {},
      FileDownloadOutlined: {},
      ShoppingBagOutlined: {},
    },
  },
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('motion-v', () => ({ AnimatePresence: {} }))

vi.mock('@/pages/main/plugin/config.vue', () => ({ default: { render: () => null } }))
vi.mock('@/pages/main/plugin/download.vue', () => ({ default: { render: () => null } }))
vi.mock('@/pages/main/plugin/list.vue', () => ({ default: { render: () => null } }))
vi.mock('@/pages/main/plugin/shop.vue', () => ({ default: { render: () => null } }))

vi.mock('../../../../src/components/plugin/actionButtonGroup.vue', () => ({
  default: window.$$lib$$.Vue.defineComponent({
    name: 'ActionButtonGroup',
    props: { actions: { type: Array, required: true } },
    setup: (props: { actions: Array<{ onClick: () => unknown; title: string }> }) => () =>
      window.$$lib$$.Vue.h(
        'div',
        { class: 'startup-actions' },
        props.actions.map(action =>
          window.$$lib$$.Vue.h('button', { onClick: action.onClick }, action.title),
        ),
      ),
  }),
}))
vi.mock('../../../../src/components/plugin/loadList.vue', () => ({
  default: { render: () => null },
}))

import PluginStartup from '../../../../src/components/plugin/index.vue'

const progress = (status: 'done' | 'error' | 'loading') =>
  shallowRef({
    reader: {
      progress: {
        ...(status === 'error' ? { errorReason: 'broken plugin' } : {}),
        status,
        stepsIndex: 0,
      },
      steps: [],
    },
  })

describe('plugin startup drawer', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    dialog.info.mockClear()
    memory.clear.mockClear()
    memory.read.mockReset().mockReturnValue(null)
    memory.remember.mockClear()
    message.error.mockClear()
    message.warning.mockClear()
    pluginRuntime.activeNormalPluginNames.splice(0)
    pluginRuntime.loadNormal.mockReset()
    pluginRuntime.reloadNormal.mockReset()
  })

  afterEach(() => wrapper?.unmount())

  const mountStartup = (startupReady = true) => {
    wrapper = mount(PluginStartup, {
      props: { isBooted: false, show: true, startupReady },
      global: { stubs: { AnimatePresence: { template: '<div><slot /></div>' } } },
    })
    return wrapper
  }

  it('blocks startup until plugin preload is ready', async () => {
    const current = mountStartup(false)

    await current.findAll('.startup-actions button')[0].trigger('click')

    expect(message.warning).toHaveBeenCalledExactlyOnceWith('plugin.startup.preloadLoading')
    expect(pluginRuntime.loadNormal).not.toHaveBeenCalled()
  })

  it('boots normally, closes the drawer and remembers only after confirmation', async () => {
    pluginRuntime.loadNormal.mockReturnValue({
      operation: Promise.resolve().then(() => pluginRuntime.activeNormalPluginNames.push('reader')),
      progress: progress('done'),
    })
    const current = mountStartup()

    await current.findAll('.startup-actions button')[0].trigger('click')
    await flushPromises()

    expect(pluginRuntime.loadNormal).toHaveBeenCalledExactlyOnceWith({ pluginNames: undefined })
    expect(current.emitted('update:isBooted')).toEqual([[true]])
    expect(current.emitted('update:show')).toEqual([[false]])
    expect(dialog.info).toHaveBeenCalledOnce()
    expect(memory.remember).not.toHaveBeenCalled()

    const prompt = dialog.info.mock.calls[0][0]
    prompt.onPositiveClick()
    expect(memory.remember).toHaveBeenCalledExactlyOnceWith(['reader'], false)
    prompt.onNegativeClick()
    expect(memory.clear).toHaveBeenCalledOnce()
  })

  it('keeps management open and reports partial plugin failures without remembering', async () => {
    pluginRuntime.loadNormal.mockReturnValue({
      operation: Promise.resolve().then(() =>
        pluginRuntime.activeNormalPluginNames.push('reader', 'sync'),
      ),
      progress: progress('error'),
    })
    const current = mountStartup()

    await current.findAll('.startup-actions button')[0].trigger('click')
    await flushPromises()

    expect(pluginRuntime.loadNormal).toHaveBeenCalledExactlyOnceWith({ pluginNames: undefined })
    expect(message.error).toHaveBeenCalledExactlyOnceWith('plugin.startup.errors.partialFailure')
    expect(current.emitted('update:isBooted')).toBeUndefined()
    expect(current.props()).toMatchObject({ show: true })
    expect(dialog.info).not.toHaveBeenCalled()
  })

  it('reloads partial active state when startup is retried', async () => {
    pluginRuntime.activeNormalPluginNames.push('reader')
    pluginRuntime.reloadNormal.mockReturnValue({
      operation: Promise.resolve(),
      progress: progress('done'),
    })
    const current = mountStartup()

    await current.findAll('.startup-actions button')[0].trigger('click')
    await flushPromises()

    expect(pluginRuntime.reloadNormal).toHaveBeenCalledExactlyOnceWith({ pluginNames: undefined })
    expect(pluginRuntime.loadNormal).not.toHaveBeenCalled()
  })

  it('automatically applies a remembered safe selection without prompting again', async () => {
    memory.read.mockReturnValue({ pluginNames: ['reader', 'sync'], safe: true, version: 1 })
    pluginRuntime.loadNormal.mockReturnValue({
      operation: Promise.resolve(),
      progress: progress('done'),
    })
    const current = mountStartup()
    await flushPromises()

    expect(pluginRuntime.loadNormal).toHaveBeenCalledExactlyOnceWith({
      pluginNames: ['reader', 'sync'],
    })
    expect(current.emitted('update:isBooted')).toEqual([[true]])
    expect(dialog.info).not.toHaveBeenCalled()
  })
})