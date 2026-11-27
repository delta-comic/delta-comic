import { isTauri } from '@tauri-apps/api/core'

import { getTauriPluginRoot } from '@/plugin/adapters/fileStore'

export const isTauriRuntime = isTauri

export interface SafeAreaInsets {
  adjustedInsetBottom?: number
  adjustedInsetLeft?: number
  adjustedInsetRight?: number
  adjustedInsetTop?: number
}

export const initializePlatform = async (): Promise<SafeAreaInsets | false> => {
  window.$api.M3 = { getInsets: async () => false, setBarColor: async () => true }
  if (!isTauriRuntime()) return false
  const { CORSFetch } = await import('@delta-comic/platform/http')
  await CORSFetch.init({
    request: { danger: { acceptInvalidCerts: true, acceptInvalidHostnames: true } },
  })
  if (__DC_APP_TARGET__ === 'desktop') return false
  const { M3 } = await import('tauri-plugin-m3')
  window.$api.M3 = M3
  return M3.getInsets()
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
  if (!isTauriRuntime() || __DC_APP_TARGET__ === 'desktop') return
  const { M3 } = await import('tauri-plugin-m3')
  await M3.setBarColor(mode)
}