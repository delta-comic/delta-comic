import {
  createAppHostProfile,
  detectWebHostPlatform,
  type AppHostProfile,
} from '@delta-comic/core/host/profile'
import { getTauriPluginRoot } from '@delta-comic/plugin'
import { isTauri } from '@tauri-apps/api/core'

import { createTauRPCProxy } from './bindings'

const rpc = createTauRPCProxy()

export const isTauriRuntime = isTauri

let hostProfilePromise: Promise<AppHostProfile> | undefined

export const resolveAppHostProfile = (): Promise<AppHostProfile> => {
  hostProfilePromise ??= (async () => {
    if (!isTauriRuntime()) {
      return createAppHostProfile({ platform: detectWebHostPlatform(), runtime: 'web' })
    }
    await rpc.app.get_runtime_platform()
    return createAppHostProfile({ platform: 'desktop', runtime: 'tauri' })
  })()
  return hostProfilePromise
}

export interface SafeAreaInsets {
  adjustedInsetBottom?: number
  adjustedInsetLeft?: number
  adjustedInsetRight?: number
  adjustedInsetTop?: number
}

export const initializePlatform = async (): Promise<SafeAreaInsets | false> => {
  if (!isTauriRuntime()) {
    window.$api.M3 = { getInsets: async () => false, setBarColor: async () => true }
    return false
  }
  const { CORSFetch } = await import('@delta-comic/http')
  await CORSFetch.init({
    request: { danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true } },
  })
  window.$api.M3 = { getInsets: async () => false, setBarColor: async () => true }
  return false
}

export const writeClipboardText = async (value: string) => {
  if (isTauriRuntime()) {
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
    await writeText(value)
    return
  }
  await navigator.clipboard.writeText(value)
}

export const readClipboardText = async () => {
  if (isTauriRuntime()) {
    const { readText } = await import('@tauri-apps/plugin-clipboard-manager')
    return await readText()
  }
  return await navigator.clipboard.readText()
}

export const openExternal = async (url: string) => {
  if (isTauriRuntime()) {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

export const openPluginDirectory = async (plugin: string) => {
  if (!isTauriRuntime()) return
  const { open } = await import('@tauri-apps/plugin-shell')
  await open(await getTauriPluginRoot(plugin))
}

export const setStatusBar = async (_mode: 'dark' | 'light') => {}