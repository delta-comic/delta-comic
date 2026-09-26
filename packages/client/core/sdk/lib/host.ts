import { withDiagnostic, type DiagnosticRecorder } from '@delta-comic/both'
import type { Kysely } from 'kysely'

import type { ClientDownloader } from './downloader.js'

export interface ClientDatabase<DB extends object> {
  readonly db: Kysely<DB>
  query<Result>(name: string, operation: (db: Kysely<DB>) => Promise<Result>): Promise<Result>
}

export const createClientDatabase = <DB extends object>(
  db: Kysely<DB>,
  diagnostics: DiagnosticRecorder,
  pluginId: string,
): ClientDatabase<DB> => ({
  db,
  query: <Result>(name: string, operation: (db: Kysely<DB>) => Promise<Result>) =>
    withDiagnostic(diagnostics, 'client database query', () => operation(db), { pluginId, name }),
})

export const instrumentClientDatabase = <DB extends object>(
  database: ClientDatabase<DB>,
  diagnostics: DiagnosticRecorder,
  pluginId: string,
): ClientDatabase<DB> => ({
  db: database.db,
  query: (name, operation) =>
    withDiagnostic(diagnostics, 'client database query', () => database.query(name, operation), {
      pluginId,
      name,
    }),
})

export const instrumentClientStore = (
  store: ClientStore,
  diagnostics: DiagnosticRecorder,
  pluginId: string,
): ClientStore => ({
  get: <T>(key: string) => {
    const value = store.get<T>(key)
    withDiagnostic(diagnostics, 'client store read', () => value, {
      pluginId,
      key,
      hit: value !== undefined,
    })
    return value
  },
  set: <T>(key: string, value: T) => {
    withDiagnostic(diagnostics, 'client store write', () => store.set(key, value), {
      pluginId,
      key,
    })
  },
  delete: key => {
    const deleted = store.delete(key)
    withDiagnostic(diagnostics, 'client store delete', () => deleted, { pluginId, key, deleted })
    return deleted
  },
  keys: () => store.keys(),
})

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
  component?: unknown
}

export interface ClientUi {
  registerRoute(route: ClientRouteRegistration): () => void
  registerNavItem(item: ClientRouteRegistration): () => void
  registerCommand(id: string, handler: () => void | Promise<void>): () => void
}

export interface ClientHost<DB extends object = Record<string, never>> {
  readonly pluginId: string
  readonly diagnostics: DiagnosticRecorder
  readonly db: ClientDatabase<DB>
  readonly store: ClientStore
  readonly ui: ClientUi
  readonly downloader?: ClientDownloader
}