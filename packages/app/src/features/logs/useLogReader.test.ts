import { describe, expect, it, vi } from 'vite-plus/test'

await vi.hoisted(async () => {
  // @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
  await import('../../../public/runtime/host-libraries.umd.js')
})

vi.mock('./loggerClient', () => ({
  loggerClient: { exportLogs: vi.fn(), listLogFiles: vi.fn(), readLogFile: vi.fn() },
}))

import type { LogReaderClient } from './loggerClient'
import type { LogFileInfo } from './model'
import { useLogReader } from './useLogReader'

const file = (path: string, modifiedAt: number): LogFileInfo => ({
  archived: path.endsWith('.gz'),
  modifiedAt,
  name: path.split('/').at(-1) ?? path,
  path,
  size: 128,
})

const createClient = (files: LogFileInfo[]): LogReaderClient => ({
  exportLogs: vi.fn(async () => '/tmp/delta-logs.zip'),
  listLogFiles: vi.fn(async () => files),
  readLogFile: vi.fn(async path => ({
    content: `[2026/07/22 10:00:00] (reader) info > ${path}`,
    path,
    size: 64,
    truncated: path.includes('old'),
  })),
})

describe('useLogReader', () => {
  it('sorts files newest first and automatically reads the newest file', async () => {
    const client = createClient([file('/logs/old.log', 1), file('/logs/current.log', 2)])
    const reader = useLogReader({ client, immediate: false })

    await reader.refresh()

    expect(reader.files.value.map(item => item.path)).toEqual([
      '/logs/current.log',
      '/logs/old.log',
    ])
    expect(reader.selectedPath.value).toBe('/logs/current.log')
    expect(reader.filteredContent.value).toContain('/logs/current.log')
  })

  it('filters selected content and reports truncation', async () => {
    const client = createClient([file('/logs/old.log', 1)])
    const reader = useLogReader({ client, immediate: false })
    await reader.refresh()

    reader.setScopeQuery('other')
    expect(reader.filteredContent.value).toBe('')
    reader.setScopeQuery('reader')
    reader.setLevel('info')

    expect(reader.filteredContent.value).toContain('/logs/old.log')
    expect(reader.selectedLogTruncated.value).toBe(true)
  })

  it('exports all listed paths and exposes the destination', async () => {
    const client = createClient([file('/logs/a.log', 1), file('/logs/b.log.gz', 2)])
    const reader = useLogReader({ client, immediate: false })
    await reader.refresh()

    await reader.exportAll()

    expect(client.exportLogs).toHaveBeenCalledWith(['/logs/b.log.gz', '/logs/a.log'])
    expect(reader.exportPath.value).toBe('/tmp/delta-logs.zip')
  })

  it('clears selection for an empty list and exposes recoverable errors', async () => {
    const client = createClient([])
    vi.mocked(client.listLogFiles).mockRejectedValueOnce(new Error('permission denied'))
    const reader = useLogReader({ client, immediate: false })

    await reader.refresh()
    expect(reader.error.value).toBe('permission denied')
    reader.clearError()
    await reader.refresh()

    expect(reader.error.value).toBeUndefined()
    expect(reader.selectedPath.value).toBeUndefined()
    expect(reader.files.value).toEqual([])
  })

  it('keeps the newest selection when earlier reads resolve late', async () => {
    let resolveOld:
      | ((value: Awaited<ReturnType<LogReaderClient['readLogFile']>>) => void)
      | undefined
    const client = createClient([])
    vi.mocked(client.readLogFile).mockImplementation(
      path =>
        new Promise(resolve => {
          if (path === '/logs/old.log') resolveOld = resolve
          else resolve({ content: 'new content', path, size: 11, truncated: false })
        }),
    )
    const reader = useLogReader({ client, immediate: false })

    const oldRead = reader.selectFile('/logs/old.log')
    await reader.selectFile('/logs/new.log')
    resolveOld?.({ content: 'old content', path: '/logs/old.log', size: 11, truncated: false })
    await oldRead

    expect(reader.selectedPath.value).toBe('/logs/new.log')
    expect(reader.filteredContent.value).toBe('new content')
  })
})