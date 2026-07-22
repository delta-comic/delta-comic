import type { DownloadTask } from './downloaderClient'

const BYTE_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB'] as const

export function formatBytes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value === 0) return '0 B'
  const absolute = Math.abs(value)
  const unit = Math.min(Math.floor(Math.log(absolute) / Math.log(1024)), BYTE_UNITS.length - 1)
  const amount = value / 1024 ** unit
  return `${amount.toFixed(unit === 0 || Math.abs(amount) >= 100 ? 0 : 1)} ${BYTE_UNITS[unit]}`
}

export function formatDuration(seconds: number | null | undefined): string | undefined {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return undefined
  if (seconds < 60) return `${Math.ceil(seconds)}s`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.ceil((seconds % 3600) / 60)
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`
}

export function taskProgress(task: DownloadTask): number {
  if (task.status === 'completed') return 100
  if (!task.totalBytes || task.totalBytes <= 0) return 0
  return Math.min(100, Math.max(0, (task.downloadedBytes / task.totalBytes) * 100))
}

export function taskEta(task: DownloadTask): number | undefined {
  if (!task.totalBytes || task.speedBytesPerSecond <= 0) return undefined
  return Math.max(0, (task.totalBytes - task.downloadedBytes) / task.speedBytesPerSecond)
}

export function taskDisplayName(task: DownloadTask): string {
  return task.title.trim() || task.relativePath.split('/').at(-1) || task.id
}

export const activeDownloadStatuses = new Set<DownloadTask['status']>([
  'probing',
  'downloading',
  'verifying',
  'seeding',
])

export const resumableDownloadStatuses = new Set<DownloadTask['status']>([
  'paused',
  'failed',
  'cancelled',
  'waitingForNetwork',
  'waitingForSource',
])