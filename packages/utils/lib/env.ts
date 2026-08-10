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

declare global {
  interface Window {
    $message: ReturnType<typeof useMessage>
    $loading: ReturnType<typeof useLoadingBar>
    $dialog: ReturnType<typeof useDialog>
    $api: Record<string, any>
    $$lib$$: Record<ExternalLibKey[keyof ExternalLibKey], any>
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