import type { useDialog, useLoadingBar, useMessage } from 'naive-ui'
import type { MaybeRefOrGetter } from 'vue'
import type { _RouterClassic, RouteLocationRaw } from 'vue-router'

import type { ExternalLibKey } from '../vite'

export interface DeltaRouterForce {
  push: (to: RouteLocationRaw) => ReturnType<_RouterClassic['push']>
  replace: (to: RouteLocationRaw) => ReturnType<_RouterClassic['replace']>
}

type RouterClassicPublicKey = Extract<keyof _RouterClassic, string>
export type DeltaRouter = Pick<_RouterClassic, RouterClassicPublicKey> & { force: DeltaRouterForce }

/**
 * 宿主应用可注册的全局 API 类型。通过 Module Augmentation 扩展：
 * `declare module '@delta-comic/utils' { interface AppApiRegistry { ... } }`
 */
export interface AppApiRegistry {
  /** `useGlobalVar` 共享状态存储，勿直接依赖 */
  __core_lib__: Record<string, unknown>
}

/**
 * 宿主应用暴露给插件的 UMD 库类型。通过 Module Augmentation 扩展：
 * `declare module '@delta-comic/utils' { interface AppLibRegistry { Vue: typeof import('vue') } }`
 */
export interface AppLibRegistry {}

declare global {
  interface Window {
    $message: ReturnType<typeof useMessage>
    $loading: ReturnType<typeof useLoadingBar>
    $dialog: ReturnType<typeof useDialog>
    $api: AppApiRegistry
    $$lib$$: AppLibRegistry & Record<ExternalLibKey[keyof ExternalLibKey], unknown>
    $router: DeltaRouter
    $isDev: boolean
  }
}

declare module 'vue-router' {
  interface TypesConfig {
    Router: DeltaRouter
    $router: DeltaRouter
  }
  interface RouteMeta {
    statusBar?: MaybeRefOrGetter<'dark' | 'light' | 'auto'>
    force?: boolean
  }
  interface RouterClassic {
    force: DeltaRouterForce
  }
}