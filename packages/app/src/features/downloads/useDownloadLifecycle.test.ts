import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h } from 'vue'

await vi.hoisted(async () => {
  // @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
  await import('../../../public/runtime/host-libraries.umd.js')
})

const mocks = vi.hoisted(() => ({
  isTauri: vi.fn(() => true),
  listen: vi.fn(),
  message: { warning: vi.fn() },
  store: {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(),
    refresh: vi.fn(async () => undefined),
  },
}))

vi.mock('@tauri-apps/api/core', () => ({ isTauri: mocks.isTauri }))
vi.mock('@tauri-apps/api/event', () => ({
  listen: mocks.listen,
  TauriEvent: { WINDOW_RESUMED: 'tauri://resumed' },
}))
vi.mock('@/stores/downloads', () => ({ useDownloadsStore: () => mocks.store }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

import { useDownloadLifecycle } from './useDownloadLifecycle'

const Host = defineComponent({
  name: 'DownloadLifecycleHost',
  setup() {
    useDownloadLifecycle()
    return () => h('div')
  },
})

describe('useDownloadLifecycle', () => {
  let wrapper: VueWrapper | undefined
  let visibilityState: DocumentVisibilityState
  let resume: (() => void) | undefined
  let unlisten: () => void

  beforeEach(() => {
    window.$message = mocks.message as unknown as typeof window.$message
    visibilityState = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState)
    resume = undefined
    unlisten = vi.fn()
    mocks.isTauri.mockReset().mockReturnValue(true)
    mocks.listen.mockReset().mockImplementation(async (_event, callback) => {
      resume = callback
      return unlisten
    })
    mocks.store.connect.mockReset().mockResolvedValue(undefined)
    mocks.store.disconnect.mockReset()
    mocks.store.refresh.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it('connects globally and refreshes on every foreground signal', async () => {
    wrapper = mount(Host)
    await flushPromises()

    expect(mocks.store.connect).toHaveBeenCalledOnce()
    expect(mocks.listen).toHaveBeenCalledExactlyOnceWith('tauri://resumed', expect.any(Function))

    visibilityState = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(mocks.store.refresh).not.toHaveBeenCalled()

    visibilityState = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('pageshow'))
    resume?.()
    await flushPromises()

    expect(mocks.store.refresh).toHaveBeenCalledTimes(4)
  })

  it('removes browser and Tauri listeners and disconnects on unmount', async () => {
    wrapper = mount(Host)
    await flushPromises()
    wrapper.unmount()
    wrapper = undefined

    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('pageshow'))
    resume?.()
    await flushPromises()

    expect(unlisten).toHaveBeenCalledOnce()
    expect(mocks.store.disconnect).toHaveBeenCalledOnce()
    expect(mocks.store.refresh).not.toHaveBeenCalled()
  })

  it('does not register native events in a web build', async () => {
    mocks.isTauri.mockReturnValue(false)
    wrapper = mount(Host)
    await flushPromises()

    expect(mocks.store.connect).toHaveBeenCalledOnce()
    expect(mocks.listen).not.toHaveBeenCalled()
  })

  it('unlistens immediately when native registration resolves after unmount', async () => {
    let resolveListener!: (value: () => void) => void
    mocks.listen.mockReturnValueOnce(
      new Promise(resolve => {
        resolveListener = resolve
      }),
    )
    wrapper = mount(Host)
    wrapper.unmount()
    wrapper = undefined

    resolveListener(unlisten)
    await flushPromises()

    expect(unlisten).toHaveBeenCalledOnce()
    expect(mocks.store.disconnect).toHaveBeenCalledOnce()
  })
})