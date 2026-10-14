import type { AppMessageSchema } from '@delta-comic/client-app-core/i18n/locales/index'
import type { DeltaRouter } from '@delta-comic/client-core-utils'

declare module 'vue' {
  interface ComponentCustomProperties {
    $router: DeltaRouter
  }
}

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends AppMessageSchema {}
}

declare module '@delta-comic/client-core-utils' {
  interface AppApiRegistry {
    M3: Pick<typeof import('tauri-plugin-m3').M3, 'getInsets' | 'setBarColor'>
  }

  interface AppLibRegistry {
    Vue: typeof import('vue')
    Naive: typeof import('naive-ui')
    VR: typeof import('vue-router')
    Pinia: typeof import('pinia')
    Pc: typeof import('@pinia/colada')
    DcUi: typeof import('@delta-comic/client-ui-ui')
    DcModel: typeof import('@delta-comic/client-core-model')
    DcPlugin: typeof import('@delta-comic/client-core-plugin')
    DcUtils: typeof import('@delta-comic/client-core-utils')
    DcDb: typeof import('@delta-comic/client-data-db')
  }
}

export {}