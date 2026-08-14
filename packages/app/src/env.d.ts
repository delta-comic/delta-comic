import type { DeltaRouter } from '@delta-comic/utils'

import type { AppMessageSchema } from './i18n/locales'

declare module 'vue' {
  interface ComponentCustomProperties {
    $router: DeltaRouter
  }
}

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends AppMessageSchema {}
}

declare module '@delta-comic/utils' {
  interface AppApiRegistry {
    M3: Pick<typeof import('tauri-plugin-m3').M3, 'getInsets' | 'setBarColor'>
  }

  interface AppLibRegistry {
    Vue: typeof import('vue')
    Naive: typeof import('naive-ui')
    VR: typeof import('vue-router')
    Pinia: typeof import('pinia')
    Pc: typeof import('@pinia/colada')
    DcUi: typeof import('@delta-comic/ui')
    DcModel: typeof import('@delta-comic/model')
    DcPlugin: typeof import('@delta-comic/plugin')
    DcUtils: typeof import('@delta-comic/utils')
    DcDb: typeof import('@delta-comic/db')
  }
}

export {}