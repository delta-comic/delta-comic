import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h, nextTick, ref, Suspense } from 'vue'
import type { SetupContext } from 'vue'

// cspell:ignore vnode

const {
  clipboard,
  definitions,
  dialog,
  intervalCallbacks,
  message,
  pluginRuntime,
  revealMainEntry,
  router,
  shareToken,
  styleRefs,
} = vi.hoisted(() => ({
  clipboard: { read: vi.fn(), write: vi.fn() },
  definitions: new Map<string, (...args: unknown[]) => unknown>(),
  dialog: { info: vi.fn() },
  intervalCallbacks: [] as Array<() => Promise<void>>,
  message: { success: vi.fn() },
  pluginRuntime: { activatePreboot: vi.fn(), clearRecovery: vi.fn(), readRecovery: vi.fn() },
  revealMainEntry: vi.fn(),
  router: { push: vi.fn() },
  shareToken: new Map<
    string,
    {
      patten: (text: string) => boolean
      show: (
        text: string,
      ) => Promise<{
        detail: string
        onNegative: () => void
        onPositive: () => void
        title: string
      }>
    }
  >(),
  styleRefs: [] as Array<{ value: string }>,
}))

await vi.hoisted(async () => {
  // @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
  await import('../public/runtime/host-libraries.umd.js')
  window.$$lib$$.VR = {
    ...window.$$lib$$.VR,
    RouterView: window.$$lib$$.Vue.defineComponent({
      name: 'RouterView',
      setup:
        (_props: Record<string, never>, { slots }: SetupContext) =>
        () =>
          window.$$lib$$.Vue.h('main', slots.default?.({ Component: 'article' })),
    }),
    useRoute: () => ({ fullPath: '/library?tab=recent', meta: { force: true } }),
    useRouter: () => router,
  }
  window.$$lib$$.Naive = {
    ...window.$$lib$$.Naive,
    useDialog: () => dialog,
    useLoadingBar: () => ({ start: vi.fn() }),
    useMessage: () => message,
    useThemeVars: () => window.$$lib$$.Vue.ref({ fontSize12: '12px', primaryColor: '#234567' }),
  }
})

vi.mock('@delta-comic/plugin', () => ({ Global: { globalNodes: [], shareToken }, pluginRuntime }))
vi.mock('@delta-comic/ui', () => ({ DcImage: { name: 'DcImage', render: () => null } }))
vi.mock('@delta-comic/utils', () => ({
  SharedFunction: {
    define: (handler: (...args: unknown[]) => unknown, _plugin: string, name: string) =>
      definitions.set(name, handler),
  },
}))
vi.mock('@vueuse/core', () => ({
  useIntervalFn: (callback: () => Promise<void>) => intervalCallbacks.push(callback),
  useStyleTag: (style: { value: string }) => styleRefs.push(style),
}))
vi.mock('es-toolkit', () => ({
  Mutex: class Mutex {
    async acquire() {}
    release() {}
  },
}))
vi.mock('motion-v', () => ({
  AnimatePresence: window.$$lib$$.Vue.defineComponent({
    name: 'AnimatePresence',
    setup:
      (_props: Record<string, never>, { slots }: SetupContext) =>
      () =>
        window.$$lib$$.Vue.h('div', slots.default?.()),
  }),
  motion: {
    div: window.$$lib$$.Vue.defineComponent({
      name: 'MotionDiv',
      inheritAttrs: false,
      setup:
        (_props: Record<string, never>, { attrs, slots }: SetupContext) =>
        () =>
          window.$$lib$$.Vue.h('div', attrs, slots.default?.()),
    }),
  },
}))
vi.mock('naive-ui', () => ({
  useDialog: () => dialog,
  useLoadingBar: () => ({ start: vi.fn() }),
  useMessage: () => message,
  useThemeVars: () => ref({ fontSize12: '12px', primaryColor: '#234567' }),
}))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ fullPath: '/library?tab=recent', meta: { force: true } }),
  useRouter: () => router,
}))
vi.mock('./platform', () => ({
  readClipboardText: clipboard.read,
  writeClipboardText: clipboard.write,
}))
vi.mock('./startup/entry', () => ({ revealMainEntry }))

vi.mock('./components/plugin/index.vue', () => ({
  default: window.$$lib$$.Vue.defineComponent({
    name: 'Plugin',
    props: { isBooted: Boolean, show: Boolean, startupReady: Boolean },
    emits: ['update:isBooted', 'update:show'],
    setup:
      (_props: Record<string, never>, { emit }: SetupContext) =>
      () =>
        window.$$lib$$.Vue.h('section', { class: 'plugin-stub' }, [
          window.$$lib$$.Vue.h(
            'button',
            { class: 'open', onClick: () => emit('update:show', true) },
            'open',
          ),
          window.$$lib$$.Vue.h(
            'button',
            { class: 'boot', onClick: () => emit('update:isBooted', true) },
            'boot',
          ),
        ]),
  }),
}))
vi.mock('./components/plugin/PrebootRecoveryAlert.vue', () => ({
  default: window.$$lib$$.Vue.defineComponent({
    name: 'PrebootRecoveryAlert',
    emits: ['dismiss', 'manage'],
    setup:
      (_props: Record<string, never>, { emit }: SetupContext) =>
      () =>
        window.$$lib$$.Vue.h('aside', { class: 'recovery-stub' }, [
          window.$$lib$$.Vue.h(
            'button',
            { class: 'dismiss', onClick: () => emit('dismiss') },
            'dismiss',
          ),
          window.$$lib$$.Vue.h(
            'button',
            { class: 'manage', onClick: () => emit('manage') },
            'manage',
          ),
        ]),
  }),
}))
vi.mock('./components/updateChecker.vue', () => ({
  default: window.$$lib$$.Vue.defineComponent({
    name: 'UpdateChecker',
    render: () => window.$$lib$$.Vue.h('div', 'update-checker'),
  }),
}))
vi.mock('./App.vue', async importOriginal => {
  const original = await importOriginal<typeof import('./App.vue')>()
  return original
})

import App from './App.vue'
import AppSetup from './AppSetup.vue'

const mountAsync = (component: typeof App) => {
  const LogicOnly = { ...component, render: () => null }
  const Host = defineComponent({
    setup: () => () => h(Suspense, null, { default: () => h(LogicOnly) }),
  })
  return mount(Host)
}

describe('App share-token orchestration', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    clipboard.read.mockReset().mockResolvedValue('ordinary text')
    clipboard.write.mockReset().mockResolvedValue(undefined)
    definitions.clear()
    dialog.info.mockClear()
    intervalCallbacks.length = 0
    message.success.mockClear()
    router.push.mockReset().mockResolvedValue(undefined)
    shareToken.clear()
    window.$dialog = dialog as unknown as typeof window.$dialog
    window.$message = message as unknown as typeof window.$message
  })

  afterEach(() => wrapper?.unmount())

  it('registers sharing, writes the token and prevents its next clipboard scan', async () => {
    wrapper = mountAsync(App)
    await flushPromises()

    expect(router.push).toHaveBeenCalledExactlyOnceWith('/library?tab=recent')
    const pushShareToken = definitions.get('pushShareToken')
    expect(pushShareToken).toBeDefined()

    await pushShareToken?.('delta://shared/42')
    clipboard.read.mockResolvedValue('delta://shared/42')
    await intervalCallbacks[0]?.()

    expect(clipboard.write).toHaveBeenCalledExactlyOnceWith('delta://shared/42')
    expect(message.success).toHaveBeenCalledExactlyOnceWith('common.feedback.copied')
    expect(dialog.info).not.toHaveBeenCalled()
  })

  it('opens a non-dismissible dialog for matching clipboard text and delegates both outcomes', async () => {
    const onPositive = vi.fn()
    const onNegative = vi.fn()
    const handler = {
      patten: vi.fn((text: string) => text.startsWith('delta://')),
      show: vi.fn(async () => ({
        detail: 'Shared comic details',
        onNegative,
        onPositive,
        title: 'Shared comic',
      })),
    }
    shareToken.set('comic', handler)
    clipboard.read.mockResolvedValue('ordinary text')

    wrapper = mountAsync(App)
    await flushPromises()
    clipboard.read.mockResolvedValue('delta://shared/99')
    await intervalCallbacks[0]?.()

    expect(handler.patten).toHaveBeenCalledWith('delta://shared/99')
    expect(handler.show).toHaveBeenCalledWith('delta://shared/99')
    expect(dialog.info).toHaveBeenCalledOnce()
    const options = dialog.info.mock.calls[0][0]
    expect(options).toMatchObject({
      closable: false,
      closeOnEsc: false,
      content: 'Shared comic details',
      maskClosable: false,
      title: 'share.tokenDetected:{"title":"Shared comic"}',
    })

    options.onPositiveClick()
    options.onNegativeClick()
    expect(onPositive).toHaveBeenCalledOnce()
    expect(onNegative).toHaveBeenCalledOnce()
  })
})

describe('AppSetup startup shell', () => {
  beforeEach(() => {
    pluginRuntime.activatePreboot.mockReset().mockResolvedValue({ reloadRequired: false })
    pluginRuntime.clearRecovery.mockClear()
    pluginRuntime.readRecovery
      .mockReset()
      .mockReturnValue({ plugins: ['reader'], reason: 'previous startup failed' })
    styleRefs.length = 0
    revealMainEntry.mockReset().mockResolvedValue(undefined)
  })

  it('exposes theme variables, activates preboot and delegates recovery actions', async () => {
    const wrapper = mount(AppSetup, {
      global: {
        stubs: {
          App: defineComponent({ name: 'App', render: () => h('main', 'main-app') }),
          DcImage: true,
          NIcon: true,
        },
      },
    })

    expect(wrapper.find('.recovery-stub').exists()).toBe(true)
    await flushPromises()
    await nextTick()
    expect(pluginRuntime.activatePreboot).toHaveBeenCalledOnce()
    expect(styleRefs[0]?.value).toContain('--nui-primary-color: #234567;')
    expect(styleRefs[0]?.value).toContain('--nui-font-size-12: 12px;')

    const recoveryListeners = wrapper.getComponent({ name: 'PrebootRecoveryAlert' }).vm.$.vnode
      .props as Record<string, (...args: unknown[]) => void>
    expect(recoveryListeners.onManage).toBeTypeOf('function')
    recoveryListeners.onManage()
    recoveryListeners.onDismiss()
    expect(pluginRuntime.clearRecovery).toHaveBeenCalledOnce()

    const pluginListeners = wrapper.getComponent({ name: 'Plugin' }).vm.$.vnode.props as Record<
      string,
      (...args: unknown[]) => void
    >
    expect(pluginListeners['onUpdate:isBooted']).toBeTypeOf('function')
    pluginListeners['onUpdate:isBooted'](true)
    wrapper.unmount()
  })

  it('reveals the main entry only after preboot activation is ready', async () => {
    let finishPreboot!: (result: { reloadRequired: boolean }) => void
    pluginRuntime.activatePreboot.mockReturnValueOnce(
      new Promise(resolve => {
        finishPreboot = resolve
      }),
    )
    const wrapper = mount(AppSetup, {
      global: {
        stubs: {
          App: defineComponent({ name: 'App', render: () => h('main', 'main-app') }),
          NIcon: true,
        },
      },
    })
    const plugin = wrapper.getComponent({ name: 'Plugin' })

    expect(plugin.props('startupReady')).toBe(false)
    expect(revealMainEntry).not.toHaveBeenCalled()

    finishPreboot({ reloadRequired: false })
    await flushPromises()
    await nextTick()

    expect(revealMainEntry).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})