import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h, nextTick, Suspense } from 'vue'
import type { SetupContext } from 'vue'

// cspell:ignore vnode

const {
  clipboard,
  definitions,
  dialog,
  downloads,
  intervalCallbacks,
  message,
  pluginRuntime,
  revealMainEntry,
  router,
  shareToken,
} = vi.hoisted(() => ({
  clipboard: { read: vi.fn(), write: vi.fn() },
  definitions: new Map<string, (...args: unknown[]) => unknown>(),
  dialog: { info: vi.fn() },
  downloads: { connect: vi.fn(), disconnect: vi.fn(), refresh: vi.fn() },
  intervalCallbacks: [] as Array<() => Promise<void>>,
  message: { success: vi.fn() },
  pluginRuntime: { clearRecovery: vi.fn(), readRecovery: vi.fn() },
  revealMainEntry: vi.fn(),
  router: { push: vi.fn() },
  shareToken: new Map<
    string,
    {
      isMatched: (text: string) => boolean
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
}))

await vi.hoisted(async () => {
  // @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
  await import('../../public/runtime/host-libraries.umd.js')
  const lib = window.$$lib$$ as { VR: Record<string, unknown>; Naive: Record<string, unknown> }
  lib.VR = {
    ...lib.VR,
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
  lib.Naive = {
    ...lib.Naive,
    useDialog: () => dialog,
    useLoadingBar: () => ({ start: vi.fn() }),
    useMessage: () => message,
  }
})

vi.mock('@delta-comic/plugin', () => ({
  configurePluginHost: vi.fn(),
  pluginI18n: { install: vi.fn() },
  pluginRuntime,
  usePluginStore: () => ({
    modelEntries: (key: string) =>
      key === 'social' ? [['comic', { share: { tokenListen: [...shareToken.values()] } }]] : [],
  }),
}))
vi.mock('@delta-comic/ui', () => ({ DcImage: { name: 'DcImage', render: () => null } }))
vi.mock('@delta-comic/utils', () => ({
  SharedFunction: {
    define: (handler: (...args: unknown[]) => unknown, _plugin: string, name: string) =>
      definitions.set(name, handler),
  },
}))
vi.mock('@/stores/downloads', () => ({ useDownloadsStore: () => downloads }))
vi.mock('@vueuse/core', () => ({
  useIntervalFn: (callback: () => Promise<void>) => intervalCallbacks.push(callback),
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
    img: window.$$lib$$.Vue.defineComponent({
      name: 'MotionImg',
      inheritAttrs: false,
      setup:
        (_props: Record<string, never>, { attrs }: SetupContext) =>
        () =>
          window.$$lib$$.Vue.h('img', attrs),
    }),
  },
}))
vi.mock('naive-ui', () => ({
  ...window.$$lib$$.Naive,
  useDialog: () => dialog,
  useLoadingBar: () => ({ start: vi.fn() }),
  useMessage: () => message,
}))
vi.mock('vue-i18n', () => ({
  createI18n: () => ({
    global: { setLocaleMessage: vi.fn(), t: (key: string) => key, te: () => false },
  }),
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}))
vi.mock('vue-router', () => ({
  ...window.$$lib$$.VR,
  useRoute: () => ({ fullPath: '/library?tab=recent', meta: { force: true } }),
  useRouter: () => router,
}))
vi.mock('../../src/platform', () => ({
  readClipboardText: clipboard.read,
  writeClipboardText: clipboard.write,
}))
vi.mock('../../src/startup/entry', () => ({ revealMainEntry }))

vi.mock('../../src/components/plugin/index.vue', () => ({
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
vi.mock('../../src/components/plugin/PluginPreloadRecoveryAlert.vue', () => ({
  default: window.$$lib$$.Vue.defineComponent({
    name: 'PluginPreloadRecoveryAlert',
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
vi.mock('../../src/components/updateChecker.vue', () => ({
  default: window.$$lib$$.Vue.defineComponent({
    name: 'UpdateChecker',
    render: () => window.$$lib$$.Vue.h('div', 'update-checker'),
  }),
}))
vi.mock('../../src/App.vue', async importOriginal => {
  const original = await importOriginal<typeof import('../../src/App.vue')>()
  return original
})

import App from '../../src/App.vue'
import AppSetup from '../../src/AppSetup.vue'

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
    downloads.connect.mockReset().mockResolvedValue(undefined)
    downloads.disconnect.mockReset()
    downloads.refresh.mockReset().mockResolvedValue(undefined)
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
    expect(downloads.connect).toHaveBeenCalledOnce()
    const pushShareToken = definitions.get('pushShareToken')
    expect(pushShareToken).toBeDefined()

    await pushShareToken?.('delta://shared/42')
    clipboard.read.mockResolvedValue('delta://shared/42')
    await intervalCallbacks[0]?.()

    expect(clipboard.write).toHaveBeenCalledExactlyOnceWith('delta://shared/42')
    expect(message.success).toHaveBeenCalledExactlyOnceWith('common.feedback.copied')
    expect(dialog.info).not.toHaveBeenCalled()
  })

  it('releases the global downloader connection with the application root', async () => {
    wrapper = mountAsync(App)
    await flushPromises()

    wrapper.unmount()
    wrapper = undefined

    expect(downloads.connect).toHaveBeenCalledOnce()
    expect(downloads.disconnect).toHaveBeenCalledOnce()
  })

  it('opens a non-dismissible dialog for matching clipboard text and delegates both outcomes', async () => {
    const onPositive = vi.fn()
    const onNegative = vi.fn()
    const handler = {
      isMatched: vi.fn((text: string) => text.startsWith('delta://')),
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

    expect(handler.isMatched).toHaveBeenCalledWith('delta://shared/99')
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
    pluginRuntime.clearRecovery.mockClear()
    pluginRuntime.readRecovery
      .mockReset()
      .mockReturnValue({ plugins: ['reader'], reason: 'previous startup failed' })
    revealMainEntry.mockReset().mockResolvedValue(undefined)
  })

  it('reveals the startup shell and delegates plugin preload recovery actions', async () => {
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
    const artwork = wrapper.get('img[src="/setup.avif"]')
    expect(artwork.attributes('aria-hidden')).toBe('true')
    await flushPromises()
    await nextTick()
    const recoveryListeners = wrapper.getComponent({ name: 'PluginPreloadRecoveryAlert' }).vm.$
      .vnode.props as Record<string, (...args: unknown[]) => void>
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

  it('reveals the main entry after the mounted shell is ready', async () => {
    const wrapper = mount(AppSetup, {
      global: {
        stubs: {
          App: defineComponent({ name: 'App', render: () => h('main', 'main-app') }),
          NIcon: true,
        },
      },
    })
    await flushPromises()
    await nextTick()

    expect(revealMainEntry).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})