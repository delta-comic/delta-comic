import type { DeltaRouter } from '@delta-comic/utils'

declare module 'vue' {
  interface ComponentCustomProperties {
    $router: DeltaRouter
  }
}

import type { AppMessageSchema } from './i18n/locales'

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends AppMessageSchema {}
}

declare module '@delta-comic/utils' {
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