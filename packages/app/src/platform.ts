import * as desktop from './platform.desktop'
import * as mobile from './platform.mobile'

const platform = __DC_APP_TARGET__ === 'desktop' ? desktop : mobile

export const isTauriRuntime = platform.isTauriRuntime
export const resolveAppHostProfile = platform.resolveAppHostProfile
export const initializePlatform = platform.initializePlatform
export const writeClipboardText = platform.writeClipboardText
export const readClipboardText = platform.readClipboardText
export const openExternal = platform.openExternal
export const openPluginDirectory = platform.openPluginDirectory
export const setStatusBar = platform.setStatusBar
export type { SafeAreaInsets } from './platform.desktop'