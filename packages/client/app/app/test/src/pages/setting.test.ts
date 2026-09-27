import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { SetupContext } from 'vue'

const mocks = vi.hoisted(() => ({
  dialog: { warning: vi.fn() },
  memory: { clear: vi.fn() },
  message: { success: vi.fn() },
  router: { back: vi.fn() },
}))

await vi.hoisted(async () => {
  const vueRuntimePath = '../../../../node_modules/vue/dist/vue.esm-bundler.js'
  const Vue = (await import(/* @vite-ignore */ vueRuntimePath)) as typeof import('vue')
  const { defineComponent, h } = Vue
  const passthrough = (name: string, tag = 'div') =>
    defineComponent({
      name,
      setup:
        (_props: Record<string, never>, { attrs, slots }: SetupContext) =>
        () =>
          h(tag, attrs, slots.default?.()),
    })
  const Button = defineComponent({
    name: 'NButton',
    emits: ['click'],
    setup:
      (_props, { emit, slots }) =>
      () =>
        h('button', { onClick: () => emit('click'), type: 'button' }, slots.default?.()),
  })
  window.$$lib$$ = {
    ...window.$$lib$$,
    Naive: {
      ...window.$$lib$$.Naive,
      NButton: Button,
      NPageHeader: passthrough('NPageHeader'),
      NScrollbar: passthrough('NScrollbar'),
      useDialog: () => mocks.dialog,
      useMessage: () => mocks.message,
    },
    Vue,
  } as typeof window.$$lib$$
})

vi.mock('@delta-comic/plugin', () => ({ useConfig: () => ({ form: new Map() }) }))
vi.mock('@delta-comic/ui', () => {
  const { defineComponent, h } = window.$$lib$$.Vue
  return {
    DcCell: defineComponent({
      name: 'DcCell',
      props: { label: String, title: String },
      setup:
        (props: { label?: string; title?: string }, { slots }: SetupContext) =>
        () =>
          h('div', [h('span', props.title), h('span', props.label), slots.default?.()]),
    }),
    DcCellGroup: defineComponent({
      name: 'DcCellGroup',
      props: { title: String },
      setup:
        (props: { title?: string }, { slots }: SetupContext) =>
        () =>
          h('section', [h('h2', props.title), slots.default?.()]),
    }),
  }
})
vi.mock('@/components/logs/LogReaderPanel.vue', () => ({ default: { render: () => null } }))
vi.mock('@/components/plugin/PluginConfigField.vue', () => ({ default: { render: () => null } }))
vi.mock('@/features/pluginStartup/PluginStartupMemory', () => ({
  pluginStartupMemory: mocks.memory,
}))
vi.mock('@/i18n', () => ({ translateText: (value: string) => value }))
vi.mock('@/i18n/pluginText', () => ({ localizeFormConfig: (value: unknown) => value }))
vi.mock('@/platform', () => ({ isTauriRuntime: () => false }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-router', () => ({ useRouter: () => mocks.router }))

import SettingsPage from '../../../src/pages/setting.vue'

describe('settings page', () => {
  beforeEach(() => {
    mocks.dialog.warning.mockReset()
    mocks.memory.clear.mockClear()
    mocks.message.success.mockClear()
  })

  it('clears remembered plugin startup content after confirmation', async () => {
    const wrapper = mount(SettingsPage)

    await wrapper.get('button').trigger('click')

    expect(mocks.dialog.warning).toHaveBeenCalledOnce()
    expect(mocks.memory.clear).not.toHaveBeenCalled()

    const confirmation = mocks.dialog.warning.mock.calls[0][0]
    confirmation.onPositiveClick()

    expect(mocks.memory.clear).toHaveBeenCalledOnce()
    expect(mocks.message.success).toHaveBeenCalledExactlyOnceWith('settings.pluginStartup.cleared')
  })
})