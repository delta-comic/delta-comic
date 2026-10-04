import type { createDownloadMessage } from '@delta-comic/ui'
import type { RouteRecordRaw } from 'vue-router'

export interface PlatformPort {
  openExternal: (url: string) => Promise<void>
  isNative: () => boolean
  listenResume: (callback: () => void) => Promise<() => void>
}

export interface NavigationPort {
  hasRoute: (name: string) => boolean
  addRoute: (route: RouteRecordRaw) => () => void
  removeRoute: (name: string) => void
}

export interface UiPort {
  warning: (message: string) => void
  createDownloadMessage: typeof createDownloadMessage
}

export interface CoreHost {
  platform: PlatformPort
  navigation: NavigationPort
  ui: UiPort
}

let host: CoreHost | undefined

export function configureCoreHost(value: CoreHost) {
  host = value
}

export function getCoreHost(): CoreHost {
  if (!host) throw new Error('Client core host has not been configured')
  return host
}