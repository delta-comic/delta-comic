import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { RegistryService } from 'cordis'
import { Miniflare } from 'miniflare'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { claimDueFlows } from '../../../../app/modules/plugins/plugins.flow.repository'
import {
  FlowService,
  runScheduledFlows,
} from '../../../../app/modules/plugins/plugins.flow.service'
import type { FlowDocument } from '../../../../lib/flow'

const mf = new Miniflare({
  workers: [
    {
      config: {
        name: 'flow-test',
        compatibilityDate: '2026-07-02',
        manifest: {
          mainModule: 'worker.mjs',
          modulesRoot: '/',
          modules: {
            'worker.mjs': {
              type: 'esm',
              contents: 'export default { fetch() { return new Response() } }',
            },
          },
        },
        env: { DB: { type: 'd1', id: 'flow-db' } },
      },
    },
  ],
})
let db: D1Database
beforeAll(async () => {
  db = await mf.getD1Database('DB')
  const migration = readFileSync(
    fileURLToPath(new URL('../../../../migrations/0005_plugin_flows.sql', import.meta.url)),
    'utf8',
  )
  for (const statement of migration.split(';').filter(sql => sql.trim()))
    await db.prepare(statement).run()
})
afterAll(() => mf.dispose())

const install = async (
  service: FlowService,
  id: string,
  document: FlowDocument,
  scheduled = false,
) => {
  const source = JSON.stringify(document)
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source)),
  )
  return service.install(id, {
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
    enabled: true,
    config: { extra: 3 },
    ...(scheduled
      ? { schedule: { flowId: 'main', enabled: true, intervalHours: 1, nextRunAt: 100 } }
      : {}),
  })
}
const document: FlowDocument = {
  version: 1,
  flows: [
    {
      id: 'main',
      steps: [
        {
          id: 'write',
          op: 'store.set',
          key: 'value',
          value: { expr: { '+': [{ var: 'input' }, { var: 'config.extra' }] } },
        },
        {
          id: 'branch',
          op: 'if',
          condition: { expr: { '>': [{ var: 'steps.write' }, 3] } },
          then: [
            { id: 'read', op: 'store.get', key: 'value' },
            { id: 'done', op: 'return', value: { expr: { var: 'steps.read' } } },
          ],
          else: [{ id: 'empty', op: 'return', value: 0 }],
        },
      ],
    },
  ],
}

describe('tenant flow lifecycle with D1', () => {
  it('loads online updates on the next call and isolates concurrent tenants and plugin keys', async () => {
    const alice = new FlowService(db, 'alice')
    const bob = new FlowService(db, 'bob')
    await Promise.all([
      install(alice, 'counter', document),
      install(bob, 'counter', document),
      install(alice, 'other', document),
    ])
    const results = await Promise.all([
      alice.run('counter', 'main', 2),
      bob.run('counter', 'main', 7),
    ])
    expect(results).toEqual([
      expect.objectContaining({ result: 5, status: 'succeeded' }),
      expect.objectContaining({ result: 10, status: 'succeeded' }),
    ])
    expect(await alice.repository.store('counter').get('value')).toBe(5)
    expect(await bob.repository.store('counter').get('value')).toBe(10)
    expect(await alice.repository.store('other').get('value')).toBeNull()
    await install(alice, 'counter', {
      version: 1,
      flows: [{ id: 'main', steps: [{ id: 'new', op: 'return', value: 42 }] }],
    })
    expect(await alice.run('counter', 'main', null)).toMatchObject({ result: 42 })
    expect(await bob.repository.listRuns('counter')).toHaveLength(1)
  })

  it('records the failing step and releases the Context', async () => {
    const service = new FlowService(db, 'failure', async () => {
      throw new Error('HTTP unavailable')
    })
    await install(service, 'broken', {
      version: 1,
      flows: [
        {
          id: 'main',
          steps: [
            { id: 'fetch', op: 'http', url: 'https://example.com' },
            { id: 'later', op: 'store.set', key: 'later', value: true },
          ],
        },
      ],
    })
    const dispose = vi.spyOn(RegistryService.prototype, 'plugin')
    try {
      expect(await service.run('broken', 'main', null)).toMatchObject({
        status: 'failed',
        stepId: 'fetch',
        error: 'HTTP unavailable',
      })
      expect(await service.repository.store('broken').get('later')).toBeNull()
      expect(dispose.mock.results.at(-1)?.value.getEffects()).toEqual([])
    } finally {
      dispose.mockRestore()
    }
  })

  it('atomically claims each due schedule once across concurrent callers', async () => {
    const service = new FlowService(db, 'schedule')
    await install(service, 'timer', document, true)
    const batches = await Promise.all([claimDueFlows(db, 100), claimDueFlows(db, 100)])
    expect(batches.flat().filter(row => row.plugin_id === 'timer')).toHaveLength(1)
    expect(await claimDueFlows(db, 100)).toEqual([])
    expect((await service.repository.find('timer'))?.schedule?.nextRunAt).toBe(3_600_100)
  })

  it('keeps a streaming Context active until the response is cancelled', async () => {
    const cancelled = vi.fn()
    const service = new FlowService(
      db,
      'stream',
      async () => new Response(new ReadableStream({ cancel: cancelled })),
    )
    await install(service, 'stream', {
      version: 1,
      flows: [
        {
          id: 'main',
          steps: [
            { id: 'fetch', op: 'http', url: 'https://example.com', response: 'stream' },
            { id: 'done', op: 'return', value: { expr: { var: 'steps.fetch' } } },
          ],
        },
      ],
    })
    const plugin = vi.spyOn(RegistryService.prototype, 'plugin')
    try {
      const response = await service.run('stream', 'main', null)
      expect(response).toBeInstanceOf(Response)
      if (!(response instanceof Response)) throw new Error('stream response required')
      expect(plugin.mock.results.at(-1)?.value.state).toBe(2)
      await response.body?.cancel()
      expect(cancelled).toHaveBeenCalledOnce()
      expect(plugin.mock.results.at(-1)?.value.state).toBe(4)
      expect(await service.repository.listRuns('stream')).toEqual([
        expect.objectContaining({ status: 'failed', error: 'flow response cancelled' }),
      ])
    } finally {
      plugin.mockRestore()
    }
  })

  it('reserves run writes when a flow exhausts its free-plan D1 query budget', async () => {
    const service = new FlowService(db, 'query-budget')
    await install(service, 'many-reads', {
      version: 1,
      flows: [
        {
          id: 'main',
          steps: Array.from({ length: 64 }, (_, index) => ({
            id: `read${index}`,
            op: 'store.get',
            key: 'value',
          })),
        },
      ],
    })
    const prepare = vi.fn((sql: string) => db.prepare(sql))
    const measured = new Proxy(db, {
      get: (target, key) => (key === 'prepare' ? prepare : Reflect.get(target, key)),
    })
    expect(
      await new FlowService(measured, 'query-budget').run('many-reads', 'main', null),
    ).toMatchObject({ status: 'failed', stepId: 'read43', error: 'flow D1 query limit exceeded' })
    expect(prepare).toHaveBeenCalledTimes(47)
    expect(await service.repository.listRuns('many-reads')).toEqual([
      expect.objectContaining({ status: 'failed', stepId: 'read43' }),
    ])
  })

  it('keeps unclaimed schedules due when the invocation reaches fifty D1 queries', async () => {
    const service = new FlowService(db, 'scheduled-budget')
    for (let index = 0; index < 11; index++)
      await install(
        service,
        `timer${index}`,
        { version: 1, flows: [{ id: 'main', steps: [{ id: 'done', op: 'return', value: 1 }] }] },
        true,
      )
    const prepare = vi.fn((sql: string) => db.prepare(sql))
    const measured = new Proxy(db, {
      get: (target, key) => (key === 'prepare' ? prepare : Reflect.get(target, key)),
    })
    await runScheduledFlows(measured, 100)
    expect(prepare).toHaveBeenCalledTimes(50)
    const due = await claimDueFlows(db, 100)
    expect(due.filter(row => row.tenant_id === 'scheduled-budget')).toHaveLength(1)
    const runs = await db
      .prepare(
        'SELECT COUNT(*) AS count FROM server_plugin_runs WHERE tenant_id = ? AND status = ?',
      )
      .bind('scheduled-budget', 'succeeded')
      .first<{ count: number }>()
    expect(runs?.count).toBe(10)
  })
})