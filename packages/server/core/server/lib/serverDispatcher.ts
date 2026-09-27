import { DiagnosticRecorder, diagnostic, type Context } from '@delta-comic/both'

import type { ServerTaskContext } from './serverHost'
import type { ServerRuntime } from './serverRuntime'

export interface ServerWorkerDispatcherOptions<Env, DB extends object> {
  readonly diagnostics?: DiagnosticRecorder
  resolveRuntime(
    request: Request,
    env: Env,
    context: ExecutionContext,
  ): ServerRuntime<DB> | Promise<ServerRuntime<DB>>
  resolveScheduledRuntimes?(
    controller: ScheduledController,
    env: Env,
    context: ExecutionContext,
  ): readonly ServerRuntime<DB>[] | Promise<readonly ServerRuntime<DB>[]>
}

export class ServerWorkerDispatcher<Env, DB extends object> {
  readonly #diagnostics: DiagnosticRecorder
  readonly #resolveRuntime: ServerWorkerDispatcherOptions<Env, DB>['resolveRuntime']
  readonly #resolveScheduledRuntimes: NonNullable<
    ServerWorkerDispatcherOptions<Env, DB>['resolveScheduledRuntimes']
  >

  public constructor(options: ServerWorkerDispatcherOptions<Env, DB>) {
    this.#diagnostics =
      options.diagnostics ?? new DiagnosticRecorder({ source: 'server-worker-dispatcher' })
    this.#resolveRuntime = options.resolveRuntime
    this.#resolveScheduledRuntimes = options.resolveScheduledRuntimes ?? (async () => [])
  }

  public get diagnostics(): DiagnosticRecorder {
    return this.#diagnostics
  }

  @diagnostic('server worker dispatcher fetch')
  public async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    const runtime = await this.#resolveRuntime(request, env, context)
    return runtime.dispatch(request)
  }

  @diagnostic('server worker dispatcher scheduled')
  public async scheduled(
    controller: ScheduledController,
    env: Env,
    context: ExecutionContext,
  ): Promise<void> {
    const runtimes = await this.#resolveScheduledRuntimes(controller, env, context)
    await Promise.all(
      runtimes.flatMap(runtime =>
        runtime.crons
          .filter(cron => cron.schedule === controller.cron)
          .map(cron => {
            const task: ServerTaskContext<DB> = {
              db: runtime.host.db,
              identity: undefined,
              diagnostics: runtime.diagnostics,
            }
            return runtime.runCron(cron.schedule, task)
          }),
      ),
    )
  }
}

export const createServerWorkerDispatcher = <Env, DB extends object>(
  options: ServerWorkerDispatcherOptions<Env, DB>,
) => new ServerWorkerDispatcher(options)

export type ServerDispatcherContext = Context