import { DiagnosticRecorder } from '@delta-comic/both'
import type { DownloaderRpc } from '@delta-comic/client-platform-downloader'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { createClientDownloader, createClientNetwork } from '../lib/index.js'

describe('client SDK', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('exposes the downloader with diagnostic command instrumentation', async () => {
    const rpc = {
      attention: { on: vi.fn() },
      cancel_task: vi.fn(),
      delete_secret: vi.fn(),
      delete_task_files: vi.fn(),
      download_ephemeral: vi.fn(),
      enqueue_plan: vi.fn(),
      enqueue_torrent: vi.fn(),
      enqueue_url: vi.fn(),
      forget_task: vi.fn(),
      get_capabilities: vi.fn(),
      get_collections: vi.fn(),
      get_settings: vi.fn(async () => ({
        maxActiveTasks: 4,
        connectionBudget: 16,
        perTaskConnections: 8,
        allowMetered: true,
        seedOnComplete: false,
        seedRatio: null,
        seedSeconds: null,
        revision: 1,
      })),
      get_task: vi.fn(),
      get_task_detail: vi.fn(),
      list_destinations: vi.fn(),
      list_tasks: vi.fn(),
      move_queue: vi.fn(),
      pause_task: vi.fn(),
      pick_destination: vi.fn(),
      resume_task: vi.fn(),
      retry_task: vi.fn(),
      set_priority: vi.fn(),
      store_secret: vi.fn(),
      task_removed: { on: vi.fn() },
      task_upsert: { on: vi.fn() },
      update_settings: vi.fn(),
      update_source: vi.fn(),
    } satisfies DownloaderRpc
    const diagnostics = new DiagnosticRecorder({ source: 'test', capacity: 20 })
    const downloader = createClientDownloader(diagnostics, 'diagnostic-source', {
      key: 'test:downloader',
      rpc,
    })

    await downloader.getSettings()
    expect(rpc.get_settings).toHaveBeenCalledExactlyOnceWith()
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