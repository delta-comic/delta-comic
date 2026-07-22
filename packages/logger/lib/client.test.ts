import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { TauriLoggerClient } from './client'
import type { Invoke, LogEntry } from './types'

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
  it('batches queued entries without blocking the caller', async () => {
    vi.useFakeTimers()
    const invoke = vi.fn<Invoke>(async () => undefined as never)
    const client = new TauriLoggerClient({ batchSize: 3, flushIntervalMs: 20, invoke })

    client.write([entry('one')])
    client.write([entry('two')])
    expect(invoke).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(20)

    expect(invoke).toHaveBeenCalledExactlyOnceWith('plugin:logger|write_logs', {
      entries: [entry('one'), entry('two')],
    })
  })

  it('flushes full batches immediately and drains the remainder', async () => {
    const invoke = vi.fn<Invoke>(async () => undefined as never)
    const client = new TauriLoggerClient({ batchSize: 2, invoke })

    client.write([entry('one'), entry('two'), entry('three')])
    await client.flush()

    expect(invoke).toHaveBeenNthCalledWith(1, 'plugin:logger|write_logs', {
      entries: [entry('one'), entry('two')],
    })
    expect(invoke).toHaveBeenNthCalledWith(2, 'plugin:logger|write_logs', {
      entries: [entry('three')],
    })
  })

  it('exposes typed reader and export plugin commands', async () => {
    const invoke = vi.fn<Invoke>(async command => {
      if (command.endsWith('list_log_files'))
        return [
          {
            archived: false,
            modifiedAt: '2026-07-22T00:00:00Z',
            name: 'app.log',
            path: '/logs/app.log',
            size: 12,
          },
        ] as never
      if (command.endsWith('read_log_file'))
        return { content: 'line', path: '/logs/app.log', size: 4, truncated: false } as never
      return '/tmp/logs.zip' as never
    })
    const client = new TauriLoggerClient({ invoke })

    await expect(client.listLogFiles()).resolves.toHaveLength(1)
    await expect(client.readLogFile('/logs/app.log')).resolves.toMatchObject({ content: 'line' })
    await expect(client.exportLogs({ paths: ['/logs/app.log'] })).resolves.toBe('/tmp/logs.zip')
    expect(invoke).toHaveBeenNthCalledWith(1, 'plugin:logger|list_log_files', undefined)
    expect(invoke).toHaveBeenNthCalledWith(2, 'plugin:logger|read_log_file', {
      path: '/logs/app.log',
    })
    expect(invoke).toHaveBeenNthCalledWith(3, 'plugin:logger|export_logs', {
      paths: ['/logs/app.log'],
    })
  })

  it('falls back without importing or invoking Tauri in web environments', async () => {
    const invoke = vi.fn<Invoke>()
    const client = new TauriLoggerClient({ invoke, native: false })

    client.write([entry('web')])
    await expect(client.flush()).resolves.toBeUndefined()
    await expect(client.listLogFiles()).rejects.toThrow('unavailable in a web browser')
    expect(invoke).not.toHaveBeenCalled()
  })

  it('contains write transport failures', async () => {
    const client = new TauriLoggerClient({
      invoke: vi.fn<Invoke>(async () => {
        throw new Error('plugin unavailable')
      }),
    })

    client.write([entry('safe')])
    await expect(client.flush()).resolves.toBeUndefined()
  })
})