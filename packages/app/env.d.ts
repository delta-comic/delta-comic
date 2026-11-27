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

  interface AppLibRegistry {
    Vue: typeof import('vue')
    Naive: typeof import('naive-ui')
    VR: typeof import('vue-router')
    VRExperimental: typeof import('vue-router/experimental')
    Pinia: typeof import('pinia')
    Pc: typeof import('@pinia/colada')
    Cordis: typeof import('cordis')
    DcClient: typeof import('@delta-comic/client')
  }
}

export {}