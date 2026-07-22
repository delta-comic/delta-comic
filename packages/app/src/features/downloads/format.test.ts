import { describe, expect, it } from 'vite-plus/test'

import type { DownloadTask } from './downloaderClient'
import { formatBytes, formatDuration, taskDisplayName, taskEta, taskProgress } from './format'

const task = {
  downloadedBytes: 256,
  id: 'task-1',
  relativePath: 'chapter/page.jpg',
  speedBytesPerSecond: 128,
  status: 'downloading',
  title: 'Page',
  totalBytes: 1024,
} as DownloadTask

describe('download formatters', () => {
  it('formats byte and duration values without losing unknown states', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1536)).toBe('1.5 KiB')
    expect(formatBytes(undefined)).toBe('—')
    expect(formatDuration(59.1)).toBe('60s')
    expect(formatDuration(3601)).toBe('1h 1m')
    expect(formatDuration(undefined)).toBeUndefined()
  })

  it('derives bounded task progress and ETA', () => {
    expect(taskProgress(task)).toBe(25)
    expect(taskEta(task)).toBe(6)
    expect(taskProgress({ ...task, downloadedBytes: 2048 })).toBe(100)
    expect(taskEta({ ...task, speedBytesPerSecond: 0 })).toBeUndefined()
  })

  it('falls back from blank titles to the destination filename', () => {
    expect(taskDisplayName(task)).toBe('Page')
    expect(taskDisplayName({ ...task, title: ' ' })).toBe('page.jpg')
  })
})