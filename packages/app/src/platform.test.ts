import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const { corsInit, getInsets, isTauri, m3SetBarColor, nativeOpen, nativeReadText, nativeWriteText } =
  vi.hoisted(() => ({
    corsInit: vi.fn(),
    getInsets: vi.fn(),
    isTauri: vi.fn(),
    m3SetBarColor: vi.fn(),
    nativeOpen: vi.fn(),
    nativeReadText: vi.fn(),
    nativeWriteText: vi.fn(),
  }))

vi.mock('@tauri-apps/api/core', () => ({ isTauri }))
vi.mock('tauri-plugin-better-cors-fetch', () => ({ CORSFetch: { init: corsInit } }))
vi.mock('tauri-plugin-m3', () => ({ M3: { getInsets, setBarColor: m3SetBarColor } }))
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  readText: nativeReadText,
  writeText: nativeWriteText,
}))
vi.mock('@tauri-apps/plugin-shell', () => ({ open: nativeOpen }))

import {
  initializePlatform,
  isTauriRuntime,
  openExternal,
  readClipboardText,
  setStatusBar,
  writeClipboardText,
} from './platform'

describe('web platform fallback', () => {
  beforeEach(() => isTauri.mockReset().mockReturnValue(false))
  afterEach(() => vi.unstubAllGlobals())

  it('uses the official Tauri runtime detector', () => {
    vi.stubGlobal('window', { $api: {} })
    expect(isTauriRuntime()).toBe(false)
    expect(isTauri).toHaveBeenCalledOnce()
  })

  it('installs a no-op native UI facade in the browser', async () => {
    const browserWindow = { $api: {} as Record<string, unknown> }
    vi.stubGlobal('window', browserWindow)

    await expect(initializePlatform()).resolves.toBe(false)
    const nativeUi = browserWindow.$api.M3 as {
      getInsets(): Promise<false>
      setBarColor(): Promise<void>
    }
    await expect(nativeUi.getInsets()).resolves.toBe(false)
    await expect(nativeUi.setBarColor()).resolves.toBeUndefined()
    await expect(setStatusBar('dark')).resolves.toBeUndefined()
  })

  it('uses browser clipboard and a protected external window on the web', async () => {
    const writeText = vi.fn(async () => undefined)
    const readText = vi.fn(async () => 'clipboard value')
    const open = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { readText, writeText } })
    vi.stubGlobal('window', { $api: {}, open })

    await writeClipboardText('next value')
    await expect(readClipboardText()).resolves.toBe('clipboard value')
    await openExternal('https://example.test/source')

    expect(writeText).toHaveBeenCalledExactlyOnceWith('next value')
    expect(readText).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledExactlyOnceWith(
      'https://example.test/source',
      '_blank',
      'noopener,noreferrer',
    )
    expect(nativeWriteText).not.toHaveBeenCalled()
    expect(nativeReadText).not.toHaveBeenCalled()
    expect(nativeOpen).not.toHaveBeenCalled()
  })

  it('initializes and delegates all native operations in a Tauri runtime', async () => {
    isTauri.mockReturnValue(true)
    const insets = { adjustedInsetBottom: 12, adjustedInsetTop: 8 }
    getInsets.mockResolvedValueOnce(insets)
    nativeReadText.mockResolvedValueOnce('native clipboard')
    const nativeWindow: { $api: { M3?: unknown } } = { $api: {} }
    vi.stubGlobal('window', nativeWindow)

    expect(isTauriRuntime()).toBe(true)
    await expect(initializePlatform()).resolves.toBe(insets)
    expect(corsInit).toHaveBeenCalledExactlyOnceWith({
      request: { danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true } },
    })
    expect(nativeWindow.$api.M3).toEqual({ getInsets, setBarColor: m3SetBarColor })

    await writeClipboardText('native value')
    await expect(readClipboardText()).resolves.toBe('native clipboard')
    await openExternal('https://example.test/native')
    await setStatusBar('light')

    expect(nativeWriteText).toHaveBeenCalledExactlyOnceWith('native value')
    expect(nativeOpen).toHaveBeenCalledExactlyOnceWith('https://example.test/native')
    expect(m3SetBarColor).toHaveBeenCalledExactlyOnceWith('light')
  })
})