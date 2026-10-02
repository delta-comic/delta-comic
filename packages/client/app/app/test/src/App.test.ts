import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h, Suspense } from 'vue'
import type { SetupContext } from 'vue'

// cspell:ignore vnode

const {
  clipboard,
  definitions,
  dialog,
  downloads,
  intervalCallbacks,
  message,
  loadEnabledPlugins,
  router,
  shareToken,
} = vi.hoisted(() => ({
  clipboard: { read: vi.fn(), write: vi.fn() },
  definitions: new Map<string, (...args: unknown[]) => unknown>(),
  dialog: { info: vi.fn() },
  downloads: { connect: vi.fn(), disconnect: vi.fn(), refresh: vi.fn() },
  intervalCallbacks: [] as Array<() => Promise<void>>,
  message: { success: vi.fn(), error: vi.fn() },
  loadEnabledPlugins: vi.fn(),
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
  loadEnabledPlugins,
  usePluginStore: () => ({
    get share() {
      return new Map([['comic', { share: { tokenListen: [...shareToken.values()] } }]])
    },
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
vi.mock('../../src/components/updateChecker.vue', () => ({
  default: window.$$lib$$.Vue.defineComponent({
    name: 'UpdateChecker',
    render: () => window.$$lib$$.Vue.h('div', 'update-checker'),
  }),
}))
vi.mock('../../src/App.vue', async importOriginal => {
  const original = await importOriginal<typeof import('../../src/App.vue')>()
  return {
    default: { ...original.default, render: () => window.$$lib$$.Vue.h('main', 'main-app') },
  }
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

describe('AppSetup application entry', () => {
  it('mounts the application and automatically loads enabled plugins', async () => {
    loadEnabledPlugins.mockResolvedValue(undefined)
    const wrapper = mount(AppSetup, {
      global: {
        stubs: { App: defineComponent({ name: 'App', render: () => h('main', 'main-app') }) },
      },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('main-app')
    expect(loadEnabledPlugins).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})