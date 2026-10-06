import type { DeltaRouter } from '@delta-comic/client-core-utils'

declare module 'vue' {
  interface ComponentCustomProperties {
    $router: DeltaRouter
  }
}

import type { AppMessageSchema } from './i18n/locales'

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends AppMessageSchema {}
}

declare module '@delta-comic/client-core-utils' {
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