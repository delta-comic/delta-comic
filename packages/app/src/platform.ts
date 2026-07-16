import { isTauri } from '@tauri-apps/api/core'

export const isTauriRuntime = isTauri

export interface SafeAreaInsets {
  adjustedInsetBottom?: number
  adjustedInsetLeft?: number
  adjustedInsetRight?: number
  adjustedInsetTop?: number
}

export const initializePlatform = async (): Promise<SafeAreaInsets | false> => {
  if (!isTauriRuntime()) {
    window.$api.M3 = { getInsets: async () => false, setBarColor: async () => undefined }
    return false
  }
  const [{ CORSFetch }, { M3 }] = await Promise.all([
    import('tauri-plugin-better-cors-fetch'),
    import('tauri-plugin-m3'),
  ])
  CORSFetch.init({
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

export const setStatusBar = async (mode: 'dark' | 'light') => {
  if (!isTauriRuntime()) return
  const { M3 } = await import('tauri-plugin-m3')
  await M3.setBarColor(mode)
}