import {
  DiagnosticHarness,
  DiagnosticReplayExecutor,
  type DiagnosticHarnessArchive,
  type DiagnosticRecorder,
} from '@delta-comic/both'

export interface DiagnosticHandlerOptions {
  diagnostics: DiagnosticRecorder
  authorize?: (request: Request) => boolean | Promise<boolean>
  path?: string
  replay?: DiagnosticReplayExecutor
}

export interface DiagnosticHandler {
  fetch(request: Request): Promise<Response>
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })

export const createDiagnosticHandler = (options: DiagnosticHandlerOptions): DiagnosticHandler => {
  const path = options.path ?? '/admin/diagnostics'
  const authorize = options.authorize ?? (() => true)
  const replay =
    options.replay ?? new DiagnosticReplayExecutor(new DiagnosticHarness(options.diagnostics))

  return {
    async fetch(request) {
      if (new URL(request.url).pathname !== path) return new Response('Not Found', { status: 404 })
      if (!(await authorize(request))) return new Response(null, { status: 401 })
      if (request.method === 'GET') return json({ ok: true, data: options.diagnostics.snapshot() })
      if (request.method !== 'POST') {
        return new Response(null, { status: 405, headers: { allow: 'GET, POST' } })
      }
      try {
        const archive = (await request.json()) as DiagnosticHarnessArchive
        await replay.replay(archive)
        return json({ ok: true, data: { replayed: archive.replay.length } })
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : 'invalid diagnostic archive' },
          400,
        )
      }
    },
  }
}