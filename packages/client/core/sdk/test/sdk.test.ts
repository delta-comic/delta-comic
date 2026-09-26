import { describe, expect, it, vi } from 'vitest'

import { ClientRuntime, type ClientDatabase, type Context } from '../lib/index.js'

const database = {
  db: {} as ClientDatabase<Record<string, never>>['db'],
  query: vi.fn(),
} as ClientDatabase<Record<string, never>>

describe('client SDK', () => {
  it('provides typed host services through Cordis injection', async () => {
    const runtime = new ClientRuntime({ pluginId: 'demo', database })
    await runtime.mount('consumer', {
      inject: ['client'],
      apply(ctx: Context) {
        ctx.client.store.set('ready', true)
        ctx.client.ui.registerRoute({ path: '/plugins/demo/home', title: 'Demo' })
      },
    })
    expect(runtime.host.store.get<boolean>('ready')).toBe(true)
    expect(runtime.snapshot().plugins[0]?.state).toBe('active')
    await runtime.dispose()
  })

  it('records database and store operations through host boundaries', async () => {
    const runtime = new ClientRuntime({ pluginId: 'diagnostics', database })
    await runtime.mount('consumer', {
      inject: ['client'],
      async apply(ctx: Context) {
        ctx.client.store.set('ready', true)
        ctx.client.store.get<boolean>('ready')
        await ctx.client.db.query('load-items', async () => [])
      },
    })
    expect(
      runtime
        .snapshot()
        .records.map(record => record.message)
        .filter(
          message => message.startsWith('client store') || message.startsWith('client database'),
        ),
    ).toEqual([
      'client store write completed',
      'client store read completed',
      'client database query completed',
    ])
    await runtime.dispose()
  })
})