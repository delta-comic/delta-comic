import { describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  exportLogs: vi.fn(async () => '/tmp/logs.zip'),
  listLogFiles: vi.fn(async () => [
    {
      archived: false,
      modifiedAt: '2026-07-22T10:00:00.000Z',
      name: 'delta.log',
      path: '/logs/delta.log',
      size: 256,
    },
  ]),
  readLogFile: vi.fn(async (path: string) => ({
    content: 'content',
    path,
    size: 7,
    truncated: false,
  })),
}))

vi.mock('@delta-comic/logger', () => ({
  TauriLoggerClient: class TauriLoggerClient {
    exportLogs = mocks.exportLogs
    listLogFiles = mocks.listLogFiles
    readLogFile = mocks.readLogFile
  },
}))

import { loggerClient } from './loggerClient'

describe('loggerClient adapter', () => {
  it('normalizes native metadata and forwards read/export contracts', async () => {
    const files = await loggerClient.listLogFiles()
    await expect(loggerClient.readLogFile('/logs/delta.log')).resolves.toMatchObject({
      content: 'content',
    })
    await expect(loggerClient.exportLogs(['/logs/delta.log'])).resolves.toBe('/tmp/logs.zip')

    expect(files[0]?.modifiedAt).toBe(Date.parse('2026-07-22T10:00:00.000Z'))
    expect(mocks.readLogFile).toHaveBeenCalledWith('/logs/delta.log')
    expect(mocks.exportLogs).toHaveBeenCalledWith({ paths: ['/logs/delta.log'] })
  })
})