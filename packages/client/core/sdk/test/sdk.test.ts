import { DiagnosticRecorder } from '@delta-comic/both'
import { describe, expect, it, vi } from 'vite-plus/test'

import { createClientDownloader, createClientNetwork } from '../lib/index.js'

describe('client SDK', () => {
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