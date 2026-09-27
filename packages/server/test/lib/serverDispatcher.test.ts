import { describe, expect, it } from 'vitest'

import { createServerWorkerDispatcher, ServerRuntime } from '../../lib/index'

describe('server worker dispatcher', () => {
  it('resolves a runtime for fetch requests', async () => {
    const runtime = new ServerRuntime({
      pluginId: 'demo',
      installationId: 'installation-1',
      db: {} as never,
    })
    await runtime.mount('routes', {
      inject: ['server'],
      apply(ctx) {
        ctx.server.registerRoute({
          method: 'GET',
          path: '/plugins/demo/health',
          public: true,
          handler: () => new Response('ok'),
        })
      },
    })
    const dispatcher = createServerWorkerDispatcher({ resolveRuntime: () => runtime })

    await expect(
      dispatcher.fetch(
        new Request('https://example.test/plugins/demo/health'),
        {},
        {} as ExecutionContext,
      ),
    ).resolves.toHaveProperty('status', 200)
    expect(
      dispatcher.diagnostics
        .list()
        .some(record => record.message === 'server worker dispatcher fetch completed'),
    ).toBe(true)
    await runtime.dispose()
  })

  it('dispatches matching cron handlers for resolved runtimes', async () => {
    const runtime = new ServerRuntime({
      pluginId: 'demo',
      installationId: 'installation-1',
      db: {} as never,
    })
    let runs = 0
    await runtime.mount('tasks', {
      inject: ['server'],
      apply(ctx) {
        ctx.server.registerCron('*/5 * * * *', () => {
          runs += 1
        })
      },
    })
    const dispatcher = createServerWorkerDispatcher({
      resolveRuntime: () => runtime,
      resolveScheduledRuntimes: () => [runtime],
    })

    await dispatcher.scheduled(
      { cron: '*/5 * * * *' } as ScheduledController,
      {},
      {} as ExecutionContext,
    )

    expect(runs).toBe(1)
    await runtime.dispose()
  })
})