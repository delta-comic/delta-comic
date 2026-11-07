import type { DeltaRouter } from '@delta-comic/client-utils'

declare module 'vue' {
  interface ComponentCustomProperties {
    $router: DeltaRouter
  }
}

import type { AppMessageSchema } from './i18n/locales'

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends AppMessageSchema {}
}

declare module '@delta-comic/client-utils' {
  interface AppLibRegistry {
    Vue: typeof import('vue')
    Naive: typeof import('naive-ui')
    VR: typeof import('vue-router')
    Pinia: typeof import('pinia')
    Pc: typeof import('@pinia/colada')
    DcUi: typeof import('@delta-comic/client-ui')
    DcModel: typeof import('@delta-comic/client-model')
    DcPlugin: typeof import('@delta-comic/client-plugin')
    DcUtils: typeof import('@delta-comic/client-utils')
    DcDb: typeof import('@delta-comic/client-db')
  }
}

export {}