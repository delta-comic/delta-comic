import type { DeltaRouter } from '@delta-comic/platform/utils'

import type { AppMessageSchema } from '@/i18n/locales/index'

declare global {
  const __DC_APP_TARGET__: 'desktop' | 'mobile'
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $router: DeltaRouter
  }
}

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends AppMessageSchema {}
}

declare module '@delta-comic/platform/utils' {
  interface AppApiRegistry {
    M3?: Pick<typeof import('tauri-plugin-m3').M3, 'getInsets' | 'setBarColor'>
  }
}

export {}