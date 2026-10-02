import type { Kysely } from 'kysely'
import type { Component } from 'vue'

export interface ClientDatabase<DB extends object> {
  readonly db: Kysely<DB>
  query<Result>(name: string, operation: (db: Kysely<DB>) => Promise<Result>): Promise<Result>
}

export interface ClientStore {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T): void
  delete(key: string): boolean
  keys(): readonly string[]
}

export interface ClientRouteRegistration {
  path: string
  title: string
  navigation?: boolean
  component?: Component
  icon?: Component
}

export interface ClientUi {
  registerRoute(route: ClientRouteRegistration): () => void
  registerNavItem(item: ClientRouteRegistration): () => void
  registerCommand(id: string, handler: () => void | Promise<void>): () => void
  registerEnvironment(
    key: string,
    component: Component,
    condition?: (args: Record<string, unknown>) => boolean | Promise<boolean>,
  ): () => void
}

export interface ClientUiRegistrars {
  readonly route?: (route: ClientRouteRegistration, owner: string) => () => void
  readonly navItem?: (item: ClientRouteRegistration, owner: string) => () => void
  readonly command?: (id: string, handler: () => void | Promise<void>, owner: string) => () => void
}