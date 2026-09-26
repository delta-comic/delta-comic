import type { DiagnosticRecorder } from '@delta-comic/both'
import type { Kysely } from 'kysely'

export interface ServerIdentity {
  readonly userId: string
  readonly installationId: string
  readonly permissions: readonly string[]
}

export interface ServerRequestContext {
  readonly request: Request
  readonly identity?: ServerIdentity
}

export interface ServerRouteHandler<DB extends object = Record<string, never>> {
  (context: ServerRequestContext, db: Kysely<DB>): Response | Promise<Response>
}

export interface ServerRouteRegistration<DB extends object = Record<string, never>> {
  method: string
  path: string
  public?: boolean
  permission?: string
  handler: ServerRouteHandler<DB>
}

export interface ServerTaskContext<DB extends object = Record<string, never>> {
  readonly db: Kysely<DB>
  readonly identity?: ServerIdentity
  readonly diagnostics: DiagnosticRecorder
}

export interface ServerMigration<DB extends object = Record<string, never>> {
  readonly id: string
  up(db: Kysely<DB>): Promise<void>
  down?(db: Kysely<DB>): Promise<void>
}

export interface ServerHost<DB extends object = Record<string, never>> {
  readonly pluginId: string
  readonly installationId: string
  readonly db: Kysely<DB>
  readonly diagnostics: DiagnosticRecorder
  registerRoute(route: ServerRouteRegistration<DB>): () => void
  registerCron(schedule: string, handler: (context: ServerTaskContext<DB>) => unknown): () => void
  registerQueue(name: string, handler: (context: ServerTaskContext<DB>) => unknown): () => void
  registerMigration(migration: ServerMigration<DB>): () => void
}