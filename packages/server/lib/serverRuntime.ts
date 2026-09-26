import {
  CordisRuntime,
  diagnostic,
  type Context,
  type DiagnosticSnapshot,
  type Plugin,
} from '@delta-comic/both'
import type { Kysely } from 'kysely'

import type {
  ServerHost,
  ServerMigration,
  ServerRequestContext,
  ServerRouteRegistration,
  ServerTaskContext,
  ServerIdentity,
} from './serverHost'

export interface ServerRuntimeOptions<DB extends object = Record<string, never>> {
  pluginId: string
  installationId: string
  db: Kysely<DB>
  identity?: ServerIdentity
  context?: Context
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
  #hostMounted = false

  public constructor(options: ServerRuntimeOptions<DB>) {
    this.#runtime = new CordisRuntime({
      source: `server:${options.pluginId}:${options.installationId}`,
      context: options.context,
    })
    this.#identity = options.identity
    this.#host = {
      pluginId: options.pluginId,
      installationId: options.installationId,
      db: options.db,
      diagnostics: this.#runtime.diagnostics,
      registerRoute: route => this.register(this.#routes, route),
      registerCron: (schedule, handler) => {
        const key = `${schedule}:${this.#crons.size}`
        this.#crons.set(key, { schedule, handler })
        return () => void this.#crons.delete(key)
      },
      registerQueue: (name, handler) => {
        this.#queues.set(name, handler)
        return () => void this.#queues.delete(name)
      },
      registerMigration: migration => {
        if (this.#migrations.has(migration.id))
          throw new Error(`migration is already registered: ${migration.id}`)
        this.#migrations.set(migration.id, migration)
        return () => void this.#migrations.delete(migration.id)
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

  public get routes(): readonly ServerRouteRegistration<DB>[] {
    return [...this.#routes]
  }

  public get migrations(): readonly ServerMigration<DB>[] {
    return [...this.#migrations.values()]
  }

  @diagnostic('server route dispatch')
  public async dispatch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const route = [...this.#routes].find(
      candidate => candidate.method === request.method && candidate.path === url.pathname,
    )
    if (!route) return new Response('Not found', { status: 404 })
    if (!route.public && !this.#identity) return new Response('Unauthorized', { status: 401 })
    if (route.permission && !this.#identity?.permissions.includes(route.permission)) {
      return new Response('Forbidden', { status: 403 })
    }
    const context: ServerRequestContext = { request, identity: this.#identity }
    return await route.handler(context, this.#host.db)
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
  public async migrate(): Promise<void> {
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

  @diagnostic('server plugin mount')
  public async mount(id: string, plugin: Plugin, config?: unknown) {
    if (!this.#hostMounted) {
      await this.context.plugin(ctx => ctx.provide('server', this.#host))
      this.#hostMounted = true
    }
    return this.#runtime.mount(id, plugin, config)
  }

  public snapshot(): DiagnosticSnapshot {
    return this.#runtime.snapshot()
  }

  @diagnostic('server plugin unmount')
  public unmount(id: string): Promise<void> {
    return this.#runtime.unmount(id)
  }

  @diagnostic('server runtime dispose')
  public dispose(): Promise<void> {
    return this.#runtime.dispose()
  }

  private register<T>(registry: Set<T>, value: T): () => void {
    registry.add(value)
    return () => void registry.delete(value)
  }
}

declare module 'cordis' {
  interface Context {
    server: ServerHost
  }
}