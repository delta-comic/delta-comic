import {
  CordisRuntime,
  DiagnosticRecorder,
  diagnostic,
  type Context,
  type DiagnosticSnapshot,
  type Plugin,
} from '@delta-comic/both'
import type { Kysely } from 'kysely'

import { createServerDiagnosticLogger, type ServerDiagnosticLogger } from './diagnostics'
import type { ServerPluginHost } from './plugin'
import { createServerPluginHostAdapter } from './serverHost'
import type {
  ServerHost,
  ServerMigration,
  ServerRequestContext,
  ServerRouteRegistration,
  ServerTaskContext,
  ServerIdentity,
} from './serverHost'
import type { ServerPluginArtifactManifest } from './serverManifest'

export interface ServerRuntimeOptions<DB extends object = Record<string, never>> {
  pluginId: string
  installationId: string
  db: Kysely<DB>
  identity?: ServerIdentity
  identityResolver?: (
    request: Request,
  ) => ServerIdentity | undefined | Promise<ServerIdentity | undefined>
  context?: Context
  pluginHost?: ServerPluginHost
}

export class ServerRuntime<DB extends object = Record<string, never>> {
  readonly #runtime: CordisRuntime
  readonly #routes = new Set<ServerRouteRegistration<DB>>()
  readonly #crons = new Map<
    string,
    { schedule: string; handler: (context: ServerTaskContext<DB>) => unknown }
  >()
  readonly #queues = new Map<string, (context: ServerTaskContext<DB>) => unknown>()
  readonly #migrations = new Map<string, ServerMigration<DB>>()
  readonly #host: ServerHost<DB>
  readonly #identity: ServerIdentity | undefined
  readonly #identityResolver: ServerRuntimeOptions<DB>['identityResolver']
  readonly #registrations = new Map<string, Set<() => void>>()
  #activePlugin: string | undefined
  #hostMounted = false

  public constructor(options: ServerRuntimeOptions<DB>) {
    this.#runtime = new CordisRuntime({
      source: `server:${options.pluginId}:${options.installationId}`,
      context: options.context,
      diagnostics: new DiagnosticRecorder({
        source: `server:${options.pluginId}:${options.installationId}`,
        pluginId: options.pluginId,
        installationId: options.installationId,
      }),
    })
    this.#identity = options.identity
    this.#identityResolver = options.identityResolver
    this.#host = {
      pluginId: options.pluginId,
      installationId: options.installationId,
      db: options.db,
      diagnostics: this.#runtime.diagnostics,
      ...(options.pluginHost
        ? {
            pluginHost: createServerPluginHostAdapter(
              this.#runtime.diagnostics,
              options.pluginHost,
            ),
          }
        : {}),
      registerRoute: route => this.register(this.#routes, route),
      registerCron: (schedule, handler) => {
        const key = `${schedule}:${this.#crons.size}`
        this.#crons.set(key, { schedule, handler })
        const disposer = () => void this.#crons.delete(key)
        this.trackRegistration(disposer)
        return disposer
      },
      registerQueue: (name, handler) => {
        this.#queues.set(name, handler)
        const disposer = () => void this.#queues.delete(name)
        this.trackRegistration(disposer)
        return disposer
      },
      registerMigration: migration => {
        if (this.#migrations.has(migration.id))
          throw new Error(`migration is already registered: ${migration.id}`)
        this.#migrations.set(migration.id, migration)
        const disposer = () => void this.#migrations.delete(migration.id)
        this.trackRegistration(disposer)
        return disposer
      },
    }
  }

  public get context(): Context {
    return this.#runtime.context
  }

  public get host(): ServerHost<DB> {
    return this.#host
  }

  public get diagnostics() {
    return this.#runtime.diagnostics
  }

  public get logger(): ServerDiagnosticLogger {
    return createServerDiagnosticLogger(
      this.#host.pluginId,
      this.#host.installationId,
      this.#runtime.diagnostics,
    )
  }

  public get routes(): readonly ServerRouteRegistration<DB>[] {
    return [...this.#routes]
  }

  public get migrations(): readonly ServerMigration<DB>[] {
    return [...this.#migrations.values()]
  }

  public get crons(): readonly { schedule: string }[] {
    return [...this.#crons.values()].map(({ schedule }) => ({ schedule }))
  }

  @diagnostic('server route dispatch')
  public async dispatch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const route = [...this.#routes].find(
      candidate => candidate.method === request.method && candidate.path === url.pathname,
    )
    if (!route) return new Response('Not found', { status: 404 })
    const identity = this.#identityResolver ? await this.#identityResolver(request) : this.#identity
    if (!route.public && !identity) return new Response('Unauthorized', { status: 401 })
    if (route.permission && !identity?.permissions.includes(route.permission)) {
      return new Response('Forbidden', { status: 403 })
    }
    const context: ServerRequestContext = { request, identity }
    try {
      return await route.handler(context, this.#host.db)
    } catch (error) {
      this.#runtime.diagnostics.record('error', 'server route failed', {
        pluginId: this.#host.pluginId,
        path: route.path,
        error: error instanceof Error ? error.message : String(error),
      })
      return new Response('Internal Server Error', { status: 500 })
    }
  }

  @diagnostic('server cron dispatch')
  public async runCron(schedule: string, context: ServerTaskContext<DB>): Promise<void> {
    const task = [...this.#crons.values()].find(candidate => candidate.schedule === schedule)
    if (!task) throw new Error(`cron is not registered: ${schedule}`)
    await task.handler(context)
  }

  @diagnostic('server queue dispatch')
  public async runQueue(name: string, context: ServerTaskContext<DB>): Promise<void> {
    const handler = this.#queues.get(name)
    if (!handler) throw new Error(`queue is not registered: ${name}`)
    await handler(context)
  }

  @diagnostic('server migration')
  public async migrate(declaredMigrationIds?: readonly string[]): Promise<void> {
    if (declaredMigrationIds !== undefined) {
      const registeredMigrationIds = new Set(this.#migrations.keys())
      const undeclared = [...registeredMigrationIds].filter(
        migrationId => !declaredMigrationIds.includes(migrationId),
      )
      const missing = declaredMigrationIds.filter(
        migrationId => !registeredMigrationIds.has(migrationId),
      )
      if (undeclared.length > 0 || missing.length > 0) {
        throw new Error(
          `artifact migration mismatch (undeclared: ${undeclared.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'})`,
        )
      }
    }
    for (const migration of this.#migrations.values()) {
      const startedAt = Date.now()
      try {
        await migration.up(this.#host.db)
        this.#runtime.diagnostics.record('info', 'server migration completed', {
          migrationId: migration.id,
          durationMs: Date.now() - startedAt,
        })
      } catch (error) {
        this.#runtime.diagnostics.record('error', 'server migration failed', {
          migrationId: migration.id,
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    }
  }

  public migrateArtifact(manifest: ServerPluginArtifactManifest): Promise<void> {
    return this.migrate(manifest.migrations)
  }

  @diagnostic('server plugin mount')
  public async mount(id: string, plugin: Plugin, config?: unknown) {
    if (!this.#hostMounted) {
      await this.context.plugin(ctx => ctx.provide('server', this.#host))
      this.#hostMounted = true
    }
    this.#activePlugin = id
    try {
      return await this.#runtime.mount(id, plugin, config)
    } finally {
      this.#activePlugin = undefined
    }
  }

  public snapshot(): DiagnosticSnapshot {
    return this.#runtime.snapshot()
  }

  @diagnostic('server plugin unmount')
  public unmount(id: string): Promise<void> {
    return this.#runtime.unmount(id).then(() => {
      for (const dispose of this.#registrations.get(id) ?? []) dispose()
      this.#registrations.delete(id)
    })
  }

  @diagnostic('server runtime dispose')
  public dispose(): Promise<void> {
    return this.#runtime.dispose().then(() => {
      for (const registrations of this.#registrations.values())
        for (const dispose of registrations) dispose()
      this.#registrations.clear()
    })
  }

  private register<T>(registry: Set<T>, value: T): () => void {
    registry.add(value)
    const disposer = () => void registry.delete(value)
    this.trackRegistration(disposer)
    return disposer
  }

  private trackRegistration(disposer: () => void): void {
    if (!this.#activePlugin) return
    const registrations = this.#registrations.get(this.#activePlugin) ?? new Set<() => void>()
    registrations.add(disposer)
    this.#registrations.set(this.#activePlugin, registrations)
  }
}

declare module 'cordis' {
  interface Context {
    server: ServerHost
  }
}