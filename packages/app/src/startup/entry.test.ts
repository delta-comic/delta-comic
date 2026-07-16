import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const { closeSplash, getAllWindows, isTauri, setFocus, showMain, supportsMultipleWindows } =
  vi.hoisted(() => ({
    closeSplash: vi.fn(),
    getAllWindows: vi.fn(),
    isTauri: vi.fn(),
    setFocus: vi.fn(),
    showMain: vi.fn(),
    supportsMultipleWindows: vi.fn(),
  }))

vi.mock('@tauri-apps/api/app', () => ({ supportsMultipleWindows }))
vi.mock('@tauri-apps/api/core', () => ({ isTauri }))
vi.mock('@tauri-apps/api/window', () => ({
  getAllWindows,
  getCurrentWindow: () => ({ label: 'main', setFocus, show: showMain }),
}))

import { initializeSplashEntry, MAIN_ENTRY_READY_MESSAGE, revealMainEntry } from './entry'

describe('startup entries', () => {
  beforeEach(() => {
    isTauri.mockReset().mockReturnValue(false)
    supportsMultipleWindows.mockReset().mockResolvedValue(false)
    getAllWindows.mockReset().mockResolvedValue([{ close: closeSplash, label: 'splash' }])
    closeSplash.mockReset().mockResolvedValue(undefined)
    setFocus.mockReset().mockResolvedValue(undefined)
    showMain.mockReset().mockResolvedValue(undefined)
    document.body.innerHTML = `
      <main id="splash" aria-busy="true"></main>
      <iframe id="main-entry" hidden></iframe>
    `
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('mounts the main web entry in a top-level iframe and waits for its ready signal', async () => {
    const setFrameSource = vi
      .spyOn(HTMLIFrameElement.prototype, 'src', 'set')
      .mockImplementation(() => undefined)
    await initializeSplashEntry()

    const frame = document.querySelector<HTMLIFrameElement>('#main-entry')
    expect(frame?.hidden).toBe(false)
    expect(setFrameSource).toHaveBeenCalledExactlyOnceWith(
      new URL('main.html', document.baseURI).href,
    )
    expect(frame?.dataset.ready).toBeUndefined()

    window.dispatchEvent(
      new MessageEvent('message', {
        data: MAIN_ENTRY_READY_MESSAGE,
        origin: location.origin,
        source: frame?.contentWindow,
      }),
    )

    expect(frame?.dataset.ready).toBe('true')
    expect(document.querySelector('#splash')?.getAttribute('aria-busy')).toBe('false')
  })

  it('keeps the native splash window lightweight when multiple windows are supported', async () => {
    isTauri.mockReturnValue(true)
    supportsMultipleWindows.mockResolvedValue(true)

    await initializeSplashEntry()

    expect(document.querySelector<HTMLIFrameElement>('#main-entry')?.src).toBe('')
  })

  it('reveals the native main window before closing the splash window', async () => {
    isTauri.mockReturnValue(true)
    supportsMultipleWindows.mockResolvedValue(true)

    await revealMainEntry()

    expect(showMain).toHaveBeenCalledOnce()
    expect(setFocus).toHaveBeenCalledOnce()
    expect(closeSplash).toHaveBeenCalledOnce()
  })

  it('does not use desktop window operations on a single-window mobile runtime', async () => {
    isTauri.mockReturnValue(true)

    await revealMainEntry()

    expect(showMain).not.toHaveBeenCalled()
    expect(getAllWindows).not.toHaveBeenCalled()
  })
})