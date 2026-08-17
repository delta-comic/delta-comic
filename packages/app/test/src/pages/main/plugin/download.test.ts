import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  dialog: { create: vi.fn() },
  installPlugin: vi.fn(),
  message: { warning: vi.fn() },
  runPluginInstall: vi.fn(),
}))

await vi.hoisted(async () => {
  const vueRuntimePath = '../../../../../node_modules/vue/dist/vue.esm-bundler.js'
  const Vue = (await import(/* @vite-ignore */ vueRuntimePath)) as typeof import('vue')
  const { defineComponent, h } = Vue
  const Button = defineComponent({
    name: 'NButton',
    props: { disabled: Boolean, loading: Boolean },
    emits: ['click'],
    setup:
      (props, { emit, slots }) =>
      () =>
        h(
          'button',
          {
            'data-loading': String(props.loading),
            'disabled': props.disabled,
            'onClick': () => emit('click'),
          },
          slots.default?.(),
        ),
  })
  const Input = defineComponent({
    name: 'NInput',
    props: { disabled: Boolean, loading: Boolean, value: String },
    emits: ['update:value'],
    setup:
      (props, { emit }) =>
      () =>
        h('input', {
          disabled: props.disabled,
          value: props.value,
          onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value),
        }),
  })
  const Scrollbar = defineComponent({
    name: 'NScrollbar',
    setup:
      (_props, { slots }) =>
      () =>
        h('div', slots.default?.()),
  })
  window.$$lib$$ = {
    ...window.$$lib$$,
    Naive: {
      NButton: Button,
      NInput: Input,
      NScrollbar: Scrollbar,
      useDialog: () => mocks.dialog,
      useMessage: () => mocks.message,
    },
    Vue,
  } as typeof window.$$lib$$
})

vi.mock('@delta-comic/logger', () => ({
  logger: { scoped: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn() }) },
}))
vi.mock('@delta-comic/plugin', () => ({ installPlugin: mocks.installPlugin }))
vi.mock('@/features/pluginInstall/usePluginInstall', () => ({
  usePluginInstall: () => ({ runPluginInstall: mocks.runPluginInstall }),
}))
vi.mock('@vueuse/core', () => ({
  toReactive: (value: unknown) => value,
  useFileDialog: () => ({
    onChange: vi.fn(() => ({ off: vi.fn() })),
    onCancel: vi.fn(() => ({ off: vi.fn() })),
    open: vi.fn(),
    reset: vi.fn(),
  }),
}))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}))

import DownloadPage from '../../../../../src/pages/main/plugin/download.vue'

interface DialogInstance {
  closable: boolean
  closeOnEsc: boolean
  content?: string
  loading: boolean
  maskClosable: boolean
  negativeButtonProps?: { disabled?: boolean }
  onAfterLeave?: () => void
  onPositiveClick?: () => unknown
  title?: string
}

const sourceUrl = 'https://example.test/plugin.zip'

describe('plugin download page', () => {
  beforeEach(() => {
    mocks.dialog.create.mockReset()
    mocks.dialog.create.mockImplementation((options: DialogInstance) => options)
    mocks.message.warning.mockClear()
    mocks.runPluginInstall.mockReset()
  })

  const mountPage = async () => {
    const wrapper = mount(DownloadPage)
    await wrapper.get('input').setValue(sourceUrl)
    return wrapper
  }

  const installButtons = (wrapper: VueWrapper) => wrapper.findAll('button')

  it('installs exactly once after the confirmation and locks the dialog while installing', async () => {
    let resolveInstall: (() => void) | undefined
    mocks.runPluginInstall.mockReturnValue(
      new Promise<void>(resolve => {
        resolveInstall = resolve
      }),
    )
    const wrapper = await mountPage()

    await installButtons(wrapper)[0].trigger('click')

    expect(mocks.dialog.create).toHaveBeenCalledTimes(1)
    const options = mocks.dialog.create.mock.calls[0][0] as DialogInstance
    const instance = mocks.dialog.create.mock.results[0].value as DialogInstance
    expect(options.title).toBe('plugin.install.confirm.title')
    expect(options.content).toBe(`plugin.install.confirm.content:{"source":"${sourceUrl}"}`)

    const install = options.onPositiveClick!()
    expect(instance.loading).toBe(true)
    expect(instance.negativeButtonProps).toEqual({ disabled: true })
    expect(instance.closable).toBe(false)
    expect(instance.maskClosable).toBe(false)
    expect(instance.closeOnEsc).toBe(false)
    expect(mocks.runPluginInstall).toHaveBeenCalledTimes(1)
    expect(mocks.runPluginInstall.mock.calls[0][0]).toBe(
      'plugin.progress.downloadTitle:{"input":"https://example.test/plugin.zip"}',
    )

    expect(options.onPositiveClick!()).toBe(false)
    expect(mocks.runPluginInstall).toHaveBeenCalledTimes(1)

    resolveInstall!()
    await flushPromises()

    await expect(install).resolves.toBeUndefined()
    expect(installButtons(wrapper)[0].attributes('disabled')).toBeUndefined()
  })

  it('disables the page actions while an install is in progress', async () => {
    mocks.runPluginInstall.mockReturnValue(new Promise<void>(() => {}))
    const wrapper = await mountPage()

    await installButtons(wrapper)[0].trigger('click')
    expect(mocks.dialog.create).toHaveBeenCalledTimes(1)
    expect(installButtons(wrapper)[0].attributes('disabled')).toBeDefined()

    await installButtons(wrapper)[0].trigger('click')

    expect(mocks.dialog.create).toHaveBeenCalledTimes(1)
    expect(mocks.message.warning).not.toHaveBeenCalled()
  })

  it('resets the busy state once the dialog finishes leaving', async () => {
    let resolveInstall: (() => void) | undefined
    mocks.runPluginInstall.mockReturnValue(
      new Promise<void>(resolve => {
        resolveInstall = resolve
      }),
    )
    const wrapper = await mountPage()

    await installButtons(wrapper)[0].trigger('click')
    const options = mocks.dialog.create.mock.calls[0][0] as DialogInstance
    options.onPositiveClick!()
    resolveInstall!()
    await flushPromises()
    options.onAfterLeave!()

    await installButtons(wrapper)[0].trigger('click')

    expect(mocks.dialog.create).toHaveBeenCalledTimes(2)
  })

  it('closes the dialog even when the installation fails', async () => {
    mocks.runPluginInstall.mockRejectedValue(new Error('download failed'))
    const wrapper = await mountPage()

    await installButtons(wrapper)[0].trigger('click')
    const options = mocks.dialog.create.mock.calls[0][0] as DialogInstance
    const install = options.onPositiveClick!()

    await expect(install).resolves.toBeUndefined()
    await flushPromises()
    expect(installButtons(wrapper)[0].attributes('disabled')).toBeUndefined()
  })
})