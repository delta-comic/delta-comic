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

export type DownloaderEventHandlers = {
  upsert?: (event: TaskUpsertEvent) => void
  removed?: (event: TaskRemovedEvent) => void
  attention?: (event: TaskAttention) => void
}

export type DownloadEphemeralOptions = {
  headers?: Record<string, string>
  secretRef?: string
  maxBytes?: number
}