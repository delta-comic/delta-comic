import type { Context } from 'cordis'
import { describe, expect, it } from 'vitest'

import { ServerRuntime } from '../../lib/index'

describe('server SDK', () => {
  it('registers typed routes and tasks within a Cordis runtime', async () => {
    const runtime = new ServerRuntime({
      pluginId: 'demo',
      installationId: 'installation-1',
      db: {} as never,
    })
    await runtime.mount('routes', {
      inject: ['server'],
      apply(ctx: Context) {
        ctx.server.registerRoute({
          method: 'GET',
          path: '/health',
          handler: () => new Response('ok'),
        })
        ctx.server.registerCron('*/5 * * * *', () => undefined)
        ctx.server.registerQueue('refresh', () => undefined)
        ctx.server.registerMigration({ id: '001-init', up: async () => undefined })
      },
    })
    expect(runtime.routes).toHaveLength(1)
    expect(runtime.migrations).toHaveLength(1)
    await expect(
      runtime.migrateArtifact({
        protocolVersion: 1,
        id: 'demo',
        name: 'Demo',
        version: '1.0.0',
        entry: './index.js',
        entryType: 'plugin',
        resources: [],
        routes: [],
        crons: [],
        queues: [],
        migrations: ['001-init'],
      }),
    ).resolves.toBeUndefined()
    await expect(
      runtime.dispatch(new Request('https://example.test/health')),
    ).resolves.toHaveProperty('status', 401)
    await expect(
      runtime.runCron('*/5 * * * *', { db: {} as never, diagnostics: runtime.host.diagnostics }),
    ).resolves.toBeUndefined()
    await expect(
      runtime.runQueue('refresh', { db: {} as never, diagnostics: runtime.host.diagnostics }),
    ).resolves.toBeUndefined()
    expect(runtime.snapshot().plugins[0]?.state).toBe('active')
    await runtime.dispose()
  })

  it('records plugin host metrics through the diagnostic boundary', async () => {
    const runtime = new ServerRuntime({
      pluginId: 'demo',
      installationId: 'installation-1',
      db: {} as never,
      pluginHost: {
        probeDatabase: async () => true,
        readMetric: async metric => (metric === 'sync.changeCount' ? 3 : 0),
      },
    })

    expect(await runtime.host.pluginHost?.probeDatabase()).toBe(true)
    expect(await runtime.host.pluginHost?.readMetric('sync.changeCount')).toBe(3)
    expect(
      runtime.diagnostics
        .list()
        .some(record => record.message === 'server plugin read metric completed'),
    ).toBe(true)
    await runtime.dispose()
  })

  it('resolves trusted identity per request and records route failures', async () => {
    const runtime = new ServerRuntime({
      pluginId: 'secure',
      installationId: 'installation-1',
      db: {} as never,
      identityResolver: request =>
        request.headers.get('x-user') === 'user-1'
          ? { userId: 'user-1', installationId: 'installation-1', permissions: ['read'] }
          : undefined,
    })
    await runtime.mount('secure-routes', {
      inject: ['server'],
      apply(ctx: Context) {
        ctx.server.registerRoute({
          method: 'GET',
          path: '/secure',
          permission: 'read',
          handler: () => new Response('ok'),
        })
        ctx.server.registerRoute({
          method: 'GET',
          path: '/broken',
          public: true,
          handler: () => {
            throw new Error('broken')
          },
        })
      },
    })
    await expect(
      runtime.dispatch(new Request('https://example.test/secure')),
    ).resolves.toHaveProperty('status', 401)
    await expect(
      runtime.dispatch(
        new Request('https://example.test/secure', { headers: { 'x-user': 'user-1' } }),
      ),
    ).resolves.toHaveProperty('status', 200)
    await expect(
      runtime.dispatch(new Request('https://example.test/broken')),
    ).resolves.toHaveProperty('status', 500)
    await runtime.dispose()
  })
})