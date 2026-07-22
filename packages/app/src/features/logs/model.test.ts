import { describe, expect, it } from 'vite-plus/test'

import { filterLogContent, formatLogFileSize } from './model'

const log = [
  '[2026/07/22 10:00:00] (startup) info > app ready',
  '[2026/07/22 10:00:01] (sync.worker) warn > first line',
  'second line',
  '[2026/07/22 10:00:02] (sync.worker) error > failed',
].join('\n')

describe('log model', () => {
  it('filters structured entries by level while preserving continuation lines', () => {
    expect(filterLogContent(log, 'warn', '')).toBe(
      '[2026/07/22 10:00:01] (sync.worker) warn > first line\nsecond line',
    )
  })

  it('combines case-insensitive scope and level filters', () => {
    expect(filterLogContent(log, 'error', 'SYNC')).toContain('sync.worker) error > failed')
    expect(filterLogContent(log, 'info', 'sync')).toBe('')
  })

  it('returns original content when filters are inactive', () => {
    expect(filterLogContent(log, 'all', '  ')).toBe(log)
  })

  it('formats compact file sizes', () => {
    expect(formatLogFileSize(0)).toBe('0 B')
    expect(formatLogFileSize(1_536)).toBe('1.5 KB')
    expect(formatLogFileSize(10 * 1024 * 1024)).toBe('10 MB')
  })
})