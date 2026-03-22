import type { useDialog, useLoadingBar, useMessage } from 'naive-ui'
import type { MaybeRefOrGetter } from 'vue'
import type { Router } from 'vue-router'

declare global {
  interface Window {
    $message: ReturnType<typeof useMessage>
    $loading: ReturnType<typeof useLoadingBar>
    $dialog: ReturnType<typeof useDialog>
    $api: Record<string, any>
    $$lib$$: Record<ExternalLibKey[keyof ExternalLibKey], any>
    $$safe$$: boolean
    $router: Router
    $isDev: boolean
  }
}

export interface ExternalLibKey {
  'vue': 'Vue'
  'vant': 'Vant'
  'naive-ui': 'Naive'
  'vue-router': 'VR'
  'pinia': 'Pinia'
  '@pinia/colada': 'Pc'
  '@delta-comic/ui': 'DcUi'
  '@delta-comic/model': 'DcModel'
  '@delta-comic/core': 'DcCore'
  '@delta-comic/plugin': 'DcPlugin'
  '@delta-comic/utils': 'DcUtils'
  '@delta-comic/require': 'DcRequire'
  '@delta-comic/db': 'DcDb'
}

export type ExternalLib = {
  [K in keyof ExternalLibKey]: `window.$$lib$$.${ExternalLibKey[K]}`
}

export const extendsDepends: ExternalLib = {
  'vue': 'window.$$lib$$.Vue',
  'vant': 'window.$$lib$$.Vant',
  'naive-ui': 'window.$$lib$$.Naive',
  'pinia': 'window.$$lib$$.Pinia',
  'vue-router': 'window.$$lib$$.VR',
  '@pinia/colada': 'window.$$lib$$.Pc',
  '@delta-comic/ui': 'window.$$lib$$.DcUi',
  '@delta-comic/model': 'window.$$lib$$.DcModel',
  '@delta-comic/core': 'window.$$lib$$.DcCore',
  '@delta-comic/plugin': 'window.$$lib$$.DcPlugin',
  '@delta-comic/utils': 'window.$$lib$$.DcUtils',
  '@delta-comic/require': 'window.$$lib$$.DcRequire',
  '@delta-comic/db': 'window.$$lib$$.DcDb'
}

declare module 'vue-router' {
  interface Router {
    force: { push: Router['push']; replace: Router['replace'] }
  }
  interface RouteMeta {
    statusBar?: MaybeRefOrGetter<'dark' | 'light' | 'auto'>
    force?: boolean
  }
}

export const useGlobalVar = <T>(val: T, key: string): T =>
  ((window.$api.__core_lib__ ??= {})[key] ??= val)