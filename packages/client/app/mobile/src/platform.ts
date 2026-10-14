import {
  createAppHostProfile,
  detectWebHostPlatform,
  type AppHostProfile,
} from '@delta-comic/client-app-core/host/profile'
import { getTauriPluginRoot } from '@delta-comic/client-core-plugin'
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
    const platform = await rpc.app.get_runtime_platform()
    return createAppHostProfile({
      platform: platform === 'ios' ? 'ios' : 'android',
      runtime: 'tauri',
    })
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
  const [{ CORSFetch }, { M3 }] = await Promise.all([
    import('@delta-comic/client-platform-http'),
    import('tauri-plugin-m3'),
  ])
  await CORSFetch.init({
    request: { danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true } },
  })
  window.$api.M3 = M3
  return await M3.getInsets()
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

export const setStatusBar = async (mode: 'dark' | 'light') => {
  if (!isTauriRuntime()) return
  const { M3 } = await import('tauri-plugin-m3')
  await M3.setBarColor(mode)
}