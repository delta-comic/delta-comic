import { withDiagnostic, type DiagnosticRecorder } from '@delta-comic/both'
import type { Kysely } from 'kysely'

import type { ServerPluginHost } from './plugin'

export interface ServerIdentity {
  readonly userId: string
  readonly installationId: string
  readonly permissions: readonly string[]
}

export const readServerIdentityHeaders = (
  request: Request,
  expectedInstallationId?: string,
): ServerIdentity | undefined => {
  const userId = request.headers.get('X-DC-User-Id')
  const installationId = request.headers.get('X-DC-Installation-Id')
  const permissionsHeader = request.headers.get('X-DC-Permissions')
  if (!userId || !installationId || !permissionsHeader) return undefined
  if (expectedInstallationId !== undefined && installationId !== expectedInstallationId)
    return undefined
  try {
    const permissions: unknown = JSON.parse(permissionsHeader)
    if (
      !Array.isArray(permissions) ||
      !permissions.every(permission => typeof permission === 'string')
    )
      return undefined
    return { userId, installationId, permissions }
  } catch {
    return undefined
  }
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
  readonly pluginHost?: ServerPluginHost
  registerRoute(route: ServerRouteRegistration<DB>): () => void
  registerCron(schedule: string, handler: (context: ServerTaskContext<DB>) => unknown): () => void
  registerQueue(name: string, handler: (context: ServerTaskContext<DB>) => unknown): () => void
  registerMigration(migration: ServerMigration<DB>): () => void
}

export const createServerPluginHostAdapter = (
  diagnostics: DiagnosticRecorder,
  host: ServerPluginHost,
): ServerPluginHost => ({
  probeDatabase: () =>
    withDiagnostic(diagnostics, 'server plugin probe database', () => host.probeDatabase()),
  readMetric: metric =>
    withDiagnostic(diagnostics, 'server plugin read metric', () => host.readMetric(metric), {
      metric,
    }),
})