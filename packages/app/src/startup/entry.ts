import { supportsMultipleWindows } from '@tauri-apps/api/app'
import { isTauri } from '@tauri-apps/api/core'

export const MAIN_ENTRY_READY_MESSAGE = 'delta-comic:main-entry-ready'

const resolveMainEntryUrl = () => new URL('main.html', document.baseURI).href

export const initializeSplashEntry = async () => {
  if (isTauri()) {
    if (!(await supportsMultipleWindows())) location.replace(resolveMainEntryUrl())
    return
  }

  // The web build has no native main window, so it must load the complete app entry itself.
  location.replace(resolveMainEntryUrl())
}

export const revealMainEntry = async () => {
  if (isTauri()) {
    if (!(await supportsMultipleWindows())) return

    const { getAllWindows, getCurrentWindow } = await import('@tauri-apps/api/window')
    const currentWindow = getCurrentWindow()
    await currentWindow.show()
    await currentWindow.setFocus()

    const splashWindow = (await getAllWindows()).find(window => window.label === 'splash')
    await splashWindow?.close()
    return
  }

  if (window.parent !== window)
    window.parent.postMessage(MAIN_ENTRY_READY_MESSAGE, window.location.origin)
}