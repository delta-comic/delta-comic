import { DiagnosticRecorder, withDiagnostic } from '@delta-comic/both'

export interface ServerWorkerAdapterOptions<Env> {
  readonly diagnostics?: DiagnosticRecorder
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response>
  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): void | Promise<void>
}

export interface ServerWorkerAdapter<Env> {
  readonly diagnostics: DiagnosticRecorder
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>
  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void>
}

export const createServerWorkerAdapter = <Env>(
  options: ServerWorkerAdapterOptions<Env>,
): ServerWorkerAdapter<Env> => {
  const diagnostics =
    options.diagnostics ?? new DiagnosticRecorder({ capacity: 1000, source: 'server-worker' })

  return {
    diagnostics,
    fetch: async (request, env, ctx) =>
      await withDiagnostic(
        diagnostics,
        'server worker fetch',
        () => options.fetch(request, env, ctx),
        { method: request.method, path: new URL(request.url).pathname },
      ),
    scheduled: async (controller, env, ctx) =>
      await withDiagnostic(
        diagnostics,
        'server worker scheduled',
        () => options.scheduled(controller, env, ctx),
        { cron: controller.cron },
      ),
  }
}