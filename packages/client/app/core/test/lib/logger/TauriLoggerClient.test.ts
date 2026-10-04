import type { LogEntry } from '@delta-comic/logger'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { createTauRPCProxy } from '../../../lib/logger/bindings'
import { TauriLoggerClient } from '../../../lib/logger/TauriLoggerClient'

type LoggerRpc = ReturnType<typeof createTauRPCProxy>['logger']

const entry = (content: string): LogEntry => ({
  content,
  level: 'info',
  scope: 'test',
  timestamp: '2026-07-22T01:02:03.000Z',
})

afterEach(() => {
  vi.useRealTimers()
})

describe('TauriLoggerClient', () => {
  const createRpc = (overrides: Partial<LoggerRpc> = {}): LoggerRpc => ({
    write_logs: vi.fn(async () => null),
    list_log_files: vi.fn(async () => []),
    read_log_file: vi.fn(async path => ({ path, content: '', size: 0, truncated: false })),
    export_logs: vi.fn(async () => '/tmp/logs.zip'),
    ...overrides,
  })

  it('batches queued entries without blocking the caller', async () => {
    vi.useFakeTimers()
    const rpc = createRpc()
    const client = new TauriLoggerClient({ batchSize: 3, flushIntervalMs: 20, rpc, native: true })

    client.write([entry('one')])
    client.write([entry('two')])
    expect(rpc.write_logs).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(20)

    expect(rpc.write_logs).toHaveBeenCalledExactlyOnceWith([entry('one'), entry('two')])
  })

  it('flushes full batches immediately and drains the remainder', async () => {
    const rpc = createRpc()
    const client = new TauriLoggerClient({ batchSize: 2, rpc, native: true })

    client.write([entry('one'), entry('two'), entry('three')])
    await client.flush()

    expect(rpc.write_logs).toHaveBeenNthCalledWith(1, [entry('one'), entry('two')])
    expect(rpc.write_logs).toHaveBeenNthCalledWith(2, [entry('three')])
  })

  it('exposes typed reader and export plugin commands', async () => {
    const rpc = createRpc({
      list_log_files: vi.fn(async () => [
        {
          archived: false,
          modifiedAt: '2026-07-22T00:00:00Z',
          name: 'app.log',
          path: '/logs/app.log',
          size: 12,
        },
      ]),
      read_log_file: vi.fn(async () => ({
        content: 'line',
        path: '/logs/app.log',
        size: 4,
        truncated: false,
      })),
      export_logs: vi.fn(async () => '/tmp/logs.zip'),
    })
    const client = new TauriLoggerClient({ rpc, native: true })

    await expect(client.listLogFiles()).resolves.toHaveLength(1)
    await expect(client.readLogFile('/logs/app.log')).resolves.toMatchObject({ content: 'line' })
    await expect(client.exportLogs({ paths: ['/logs/app.log'] })).resolves.toBe('/tmp/logs.zip')
    expect(rpc.list_log_files).toHaveBeenCalledExactlyOnceWith()
    expect(rpc.read_log_file).toHaveBeenCalledExactlyOnceWith('/logs/app.log')
    expect(rpc.export_logs).toHaveBeenCalledExactlyOnceWith(['/logs/app.log'])
  })

  it('falls back without importing or invoking Tauri in web environments', async () => {
    const rpc = createRpc()
    const client = new TauriLoggerClient({ rpc, native: false })

    client.write([entry('web')])
    await client.flush()
    await expect(client.listLogFiles()).rejects.toThrow('unavailable in a web browser')
    expect(rpc.write_logs).not.toHaveBeenCalled()
  })

  it('contains write transport failures', async () => {
    const rpc = createRpc({
      write_logs: vi.fn(async () => {
        throw new Error('plugin unavailable')
      }),
    })
    const client = new TauriLoggerClient({ rpc, native: true })

    client.write([entry('safe')])
    await client.flush()
  })
})