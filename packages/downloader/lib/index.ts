import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export type TaskKind = 'http' | 'torrent'

export type TaskStatus =
  | 'queued'
  | 'probing'
  | 'downloading'
  | 'waitingForNetwork'
  | 'waitingForSource'
  | 'paused'
  | 'verifying'
  | 'seeding'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type Checksum = { algorithm: 'sha256' | 'md5'; value: string }

export type HttpMirror = {
  url: string
  priority?: number
  headers?: Record<
    string,
    { type: 'value'; value: string } | { type: 'secretRef'; secretRef: string }
  >
}

export type HttpSource = {
  type: 'http'
  mirrors: HttpMirror[]
  expectedSize?: number
  etag?: string
  lastModified?: string
  expiresAt?: number
}

export type TorrentInput =
  | { type: 'magnet'; uri: string }
  | { type: 'url'; url: string }
  | { type: 'bytes'; base64: string }

export type SeedPolicy =
  | { mode: 'none' }
  | { mode: 'ratio'; ratio: number }
  | { mode: 'duration'; durationSeconds: number }
  | { mode: 'ratioOrDuration'; ratio: number; durationSeconds: number }

export type TorrentSource = {
  type: 'torrent'
  input: TorrentInput
  onlyFiles?: number[]
  seedPolicy?: SeedPolicy
}

export type DownloadSource = HttpSource | TorrentSource

export type DownloadTask = {
  id: string
  collectionKey?: string
  assetKey?: string
  kind: TaskKind
  title: string
  source: DownloadSource
  destinationId: string
  relativePath: string
  status: TaskStatus
  priority: number
  queuePosition: number
  totalBytes?: number
  downloadedBytes: number
  speedBytesPerSecond: number
  errorCode?: string
  errorMessage?: string
  checksum?: Checksum
  etag?: string
  lastModified?: string
  finalPath?: string
  retryCount: number
  createdAt: number
  updatedAt: number
  revision: number
}

export type DownloadCollection = {
  key: string
  title: string
  destinationId: string
  refreshContext?: ContentRefreshContext
  taskCount: number
  completedTasks: number
  totalBytes?: number
  downloadedBytes: number
  createdAt: number
}

export type ContentRefreshContext = {
  plugin: string
  contentType: [string, string]
  contentId: string
  episodeId: string
  contentPageFingerprint?: string
  providerFingerprint: string
  pluginVersion?: string
  pluginIntegrity?: string
}

export type ByteRange = { start: number; end: number }

export type TorrentTaskDetail = {
  infoHash?: string
  uploadedBytes: number
  peerCount: number
  seedStartedAt?: number
}

export type DownloadTaskDetail = {
  task: DownloadTask
  completedRanges: ByteRange[]
  torrent?: TorrentTaskDetail
}

export type DownloadAsset = {
  key: string
  relativePath: string
  size?: number
  checksum?: Checksum
  source: DownloadSource
}

export type EnqueuePlanInput = {
  key: string
  title: string
  assets: DownloadAsset[]
  destinationId?: string
  priority?: number
  refreshContext?: ContentRefreshContext
}

export type EnqueueUrlInput = {
  url: string
  title?: string
  relativePath?: string
  destinationId?: string
  priority?: number
  checksum?: Checksum
  mirrors?: HttpMirror[]
}

export type EnqueueTorrentInput = {
  source: Omit<TorrentSource, 'type'>
  title?: string
  relativePath?: string
  destinationId?: string
  priority?: number
}

export type DownloaderSettings = {
  maxActiveTasks: number
  connectionBudget: number
  perTaskConnections: number
  allowMetered: boolean
  seedOnComplete: boolean
  seedRatio?: number
  seedSeconds?: number
  revision: number
}

export type DownloaderCapabilities = { connectionBudgetMax: number; maxActiveTasks: number }

export type Destination = {
  id: string
  label: string
  kind: 'managed' | 'desktopDirectory' | 'androidSaf'
  isDefault: boolean
}

export type TaskUpsertEvent = { task: DownloadTask; revision: number }
export type TaskRemovedEvent = { taskId: string; revision: number }
export type TaskAttention = { taskId: string; code: string; message: string; revision: number }

export type DownloadEphemeralOptions = {
  headers?: Record<string, string>
  secretRef?: string
  maxBytes?: number
}

const command = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> =>
  await invoke<T>(`plugin:downloader|${name}`, args)

const normalizeRawBytes = (
  value: ArrayBuffer | Uint8Array | readonly number[],
): Uint8Array<ArrayBuffer> => {
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (value instanceof Uint8Array) return Uint8Array.from(value)
  if (Array.isArray(value)) return Uint8Array.from(value)
  throw new TypeError('downloader returned an invalid ephemeral response')
}

/**
 * Downloads a short-lived resource without creating a managed task or emitting task events.
 * The native backend removes all temporary state on success, cancellation, and failure.
 */
export const downloadEphemeral = async (
  url: string,
  options: DownloadEphemeralOptions = {},
): Promise<Uint8Array<ArrayBuffer>> => {
  const bytes = await command<ArrayBuffer | Uint8Array | number[]>('download_ephemeral', {
    url,
    ...options,
  })
  return normalizeRawBytes(bytes)
}

/** Stores a header/cookie/token value in the operating system credential vault. */
export const storeSecret = async (value: string): Promise<string> =>
  await command('store_secret', { value })

/** Deletes a native credential reference. Deletion is idempotent. */
export const deleteSecret = async (secretRef: string): Promise<void> =>
  await command('delete_secret', { secretRef })

export const listTasks = async (): Promise<DownloadTask[]> => await command('list_tasks')

export const getTask = async (id: string): Promise<DownloadTask | null> =>
  await command('get_task', { id })

export const getTaskDetail = async (id: string): Promise<DownloadTaskDetail> =>
  await command('get_task_detail', { id })

export const getCollections = async (): Promise<DownloadCollection[]> =>
  await command('get_collections')

export const listDestinations = async (): Promise<Destination[]> =>
  await command('list_destinations')

export const getSettings = async (): Promise<DownloaderSettings> => await command('get_settings')

export const getCapabilities = async (): Promise<DownloaderCapabilities> =>
  await command('get_capabilities')

export const updateSettings = async (
  patch: Partial<Omit<DownloaderSettings, 'revision'>>,
): Promise<DownloaderSettings> => {
  const settings = { ...(await getSettings()), ...patch }
  return await command('update_settings', { settings })
}

export const enqueueUrl = async (input: EnqueueUrlInput): Promise<DownloadTask> =>
  await command('enqueue_url', { input })

export const enqueueTorrent = async (input: EnqueueTorrentInput): Promise<DownloadTask> =>
  await command('enqueue_torrent', { input })

export const enqueuePlan = async (input: EnqueuePlanInput): Promise<DownloadTask[]> =>
  await command('enqueue_plan', { input })

export const pauseTask = async (id: string): Promise<DownloadTask> =>
  await command('pause_task', { id })

export const resumeTask = async (id: string): Promise<DownloadTask> =>
  await command('resume_task', { id })

export const retryTask = async (id: string): Promise<DownloadTask> =>
  await command('retry_task', { id })

export const cancelTask = async (id: string): Promise<DownloadTask> =>
  await command('cancel_task', { id })

export const forgetTask = async (id: string): Promise<void> => await command('forget_task', { id })

export const deleteTaskFiles = async (id: string): Promise<void> =>
  await command('delete_task_files', { id })

export const setPriority = async (id: string, priority: number): Promise<DownloadTask> =>
  await command('set_priority', { id, priority })

export const moveQueue = async (id: string, beforeTaskId?: string | null): Promise<DownloadTask> =>
  await command('move_queue', { id, beforeTaskId })

/** Opens the platform-owned directory picker and registers the granted destination. */
export const pickDestination = async (): Promise<Destination | null> =>
  await command('pick_destination')

export const updateSource = async (id: string, source: DownloadSource): Promise<DownloadTask> =>
  await command('update_source', { id, source })

export const listenTaskUpsert = async (
  handler: (event: TaskUpsertEvent) => void,
): Promise<UnlistenFn> =>
  await listen<TaskUpsertEvent>('downloader://task-upsert', ({ payload }) => handler(payload))

export const listenTaskRemoved = async (
  handler: (event: TaskRemovedEvent) => void,
): Promise<UnlistenFn> =>
  await listen<TaskRemovedEvent>('downloader://task-removed', ({ payload }) => handler(payload))

export const listenAttention = async (
  handler: (event: TaskAttention) => void,
): Promise<UnlistenFn> =>
  await listen<TaskAttention>('downloader://attention', ({ payload }) => handler(payload))

export const listenDownloaderEvents = async (handlers: {
  upsert?: (event: TaskUpsertEvent) => void
  removed?: (event: TaskRemovedEvent) => void
  attention?: (event: TaskAttention) => void
}): Promise<UnlistenFn> => {
  const unlisten = await Promise.all([
    handlers.upsert ? listenTaskUpsert(handlers.upsert) : undefined,
    handlers.removed ? listenTaskRemoved(handlers.removed) : undefined,
    handlers.attention ? listenAttention(handlers.attention) : undefined,
  ])
  return () => {
    for (const dispose of unlisten) dispose?.()
  }
}

export const pause = pauseTask
export const resume = resumeTask
export const retry = retryTask
export const cancel = cancelTask
export const forget = forgetTask
export const deleteFiles = deleteTaskFiles