import { DiagnosticRecorder } from '@delta-comic/both'
import { environmentRegistry } from '@delta-comic/ui/environment'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import {
  ClientRuntime,
  createClientDownloader,
  createClientNetwork,
  type ClientDatabase,
  type Context,
} from '../lib/index.js'

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

  it('exposes the downloader with diagnostic command instrumentation', async () => {
    const invoke = vi.fn()
    const diagnostics = new DiagnosticRecorder({ source: 'test', capacity: 20 })
    const downloader = createClientDownloader(diagnostics, 'diagnostic-source', {
      key: 'test:downloader',
      transport: {
        invoke: async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
          invoke(command, args)
          return { revision: 1 } as T
        },
        listen: async () => () => undefined,
      },
    })

    await downloader.getSettings()
    expect(invoke).toHaveBeenCalledWith('plugin:downloader|get_settings', {})
    expect(diagnostics.list().map(record => record.message)).toEqual([
      'client downloader get settings completed',
    ])
    downloader.dispose()
  })

  it('removes plugin environment registrations during runtime disposal', async () => {
    const runtime = new ClientRuntime({ pluginId: 'environment', database })
    const component = defineComponent({ template: '<div />' })
    let removeEnvironment: (() => void) | undefined

    await runtime.mount('consumer', {
      inject: ['client'],
      apply(ctx: Context) {
        removeEnvironment = ctx.client.ui.registerEnvironment('test-environment', component)
      },
    })

    expect(environmentRegistry.forKey('test-environment')).toHaveLength(1)
    removeEnvironment?.()
    expect(environmentRegistry.forKey('test-environment')).toHaveLength(0)

    await runtime.mount('second-consumer', {
      inject: ['client'],
      apply(ctx: Context) {
        ctx.client.ui.registerEnvironment('test-environment', component)
      },
    })
    expect(environmentRegistry.forKey('test-environment')).toHaveLength(1)
    await runtime.dispose()
    expect(environmentRegistry.forKey('test-environment')).toHaveLength(0)
  })

  it('provides an injectable network transport with diagnostics', async () => {
    const diagnostics = new DiagnosticRecorder({ source: 'network-test' })
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://example.test/items')
      expect(init?.method).toBe('GET')
      return new Response('ok', { status: 200 })
    })
    const network = createClientNetwork(diagnostics, 'network', { transport: { fetch } })
    const response = await network.get('https://example.test/items')
    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledOnce()
    expect(diagnostics.list().map(record => record.message)).toEqual([
      'client network request completed',
    ])
  })
})