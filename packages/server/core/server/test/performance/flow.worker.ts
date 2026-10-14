import { FlowService } from '../../app/modules/plugins/plugins.flow.service'
import type { FlowDocument, FlowRun } from '../../lib/flow'

interface QueryMetrics {
  queries: number
  rowsRead: number
  rowsWritten: number
  durationMs: number
}

const measureDatabase = (db: D1Database, metrics: QueryMetrics): D1Database => {
  const collect = (result: D1Result) => {
    metrics.queries++
    metrics.rowsRead += result.meta.rows_read
    metrics.rowsWritten += result.meta.rows_written
    metrics.durationMs += result.meta.duration
  }
  const statement = (target: D1PreparedStatement): D1PreparedStatement =>
    new Proxy(target, {
      get(target, key) {
        if (key === 'bind') return (...values: unknown[]) => statement(target.bind(...values))
        if (key === 'first')
          return async (column?: string) => {
            const result = await target.all<Record<string, unknown>>()
            collect(result)
            const row = result.results[0]
            return row ? (column === undefined ? row : row[column]) : null
          }
        if (key === 'all' || key === 'run')
          return async () => {
            const result = await target[key]()
            collect(result)
            return result
          }
        const value: unknown = Reflect.get(target, key)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
  return new Proxy(db, {
    get(target, key) {
      if (key === 'prepare') return (sql: string) => statement(target.prepare(sql))
      const value: unknown = Reflect.get(target, key)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

const documents = (httpUrl: string): Record<string, FlowDocument> => ({
  return: {
    version: 1,
    flows: [
      { id: 'main', steps: [{ id: 'done', op: 'return', value: { expr: { var: 'input' } } }] },
    ],
  },
  store: {
    version: 1,
    flows: [
      {
        id: 'main',
        steps: [
          { id: 'read', op: 'store.get', key: 'value' },
          {
            id: 'branch',
            op: 'if',
            condition: { expr: { '>': [{ var: 'input' }, 0] } },
            then: [
              {
                id: 'write',
                op: 'store.set',
                key: 'value',
                value: { expr: { '+': [{ var: ['steps.read', 0] }, { var: 'input' }] } },
              },
            ],
          },
          { id: 'done', op: 'return', value: { expr: { var: 'steps.write' } } },
        ],
      },
    ],
  },
  http: {
    version: 1,
    flows: [
      {
        id: 'main',
        steps: [
          { id: 'fetch', op: 'http', url: httpUrl, method: 'POST', body: { value: 2 } },
          {
            id: 'write',
            op: 'store.set',
            key: 'value',
            value: { expr: { var: 'steps.fetch.body' } },
          },
          { id: 'done', op: 'return', value: { expr: { var: 'steps.write' } } },
        ],
      },
    ],
  },
})

export default {
  async fetch(request: Request, env: { DB: D1Database }) {
    const url = new URL(request.url)
    const id = url.searchParams.get('scenario') ?? 'return'
    const service = new FlowService(env.DB, 'measurement')
    if (url.pathname === '/install') {
      const source = JSON.stringify(documents(url.searchParams.get('httpUrl') ?? '')[id])
      const digest = new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source)),
      )
      await service.install(id, {
        manifest: {
          protocolVersion: 2,
          id,
          name: id,
          version: '1.0.0',
          server: { entry: 'flows.json' },
          resources: [
            {
              path: 'flows.json',
              mimeType: 'application/json',
              imports: [],
              integrity: `sha256-${btoa(String.fromCharCode(...digest))}`,
            },
          ],
        },
        source,
        config: {},
        enabled: true,
      })
      return new Response('installed')
    }
    const database: QueryMetrics = { queries: 0, rowsRead: 0, rowsWritten: 0, durationMs: 0 }
    let httpRequests = 0
    const measured = new FlowService(
      measureDatabase(env.DB, database),
      'measurement',
      async (input, init) => {
        httpRequests++
        return await fetch(input, init)
      },
    )
    const run: FlowRun | Response = await measured.run(id, 'main', 2)
    if (run instanceof Response) throw new Error('measurement requires a JSON result')
    return Response.json({ run, database, httpRequests })
  },
}