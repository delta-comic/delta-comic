import { createTauRPCProxy } from './bindings'
import type {
  AttentionEvent as RpcAttentionEvent,
  Checksum as RpcChecksum,
  ContentRefreshContext as RpcContentRefreshContext,
  DownloadAsset as RpcDownloadAsset,
  DownloadCollection as RpcDownloadCollection,
  DownloaderSettings as RpcDownloaderSettings,
  DownloadSource as RpcDownloadSource,
  DownloadTask as RpcDownloadTask,
  DownloadTaskDetail as RpcDownloadTaskDetail,
  HttpMirror as RpcHttpMirror,
  SeedPolicy as RpcSeedPolicy,
  TaskRemovedEvent as RpcTaskRemovedEvent,
  TaskUpsertEvent as RpcTaskUpsertEvent,
} from './bindings'
import type {
  Checksum,
  ContentRefreshContext,
  Destination,
  DownloadCollection,
  DownloadEphemeralOptions,
  DownloadAsset,
  DownloaderCapabilities,
  DownloaderEventHandlers,
  DownloaderSettings,
  DownloadSource,
  DownloadTask,
  DownloadTaskDetail,
  EnqueuePlanInput,
  EnqueueTorrentInput,
  EnqueueUrlInput,
  HttpMirror,
  SeedPolicy,
  TaskAttention,
  TaskRemovedEvent,
  TaskUpsertEvent,
} from './types'

export type DownloaderRpc = ReturnType<typeof createTauRPCProxy>['downloader']

export type DownloaderUnlisten = () => void

const toRpcChecksum = (checksum: Checksum | undefined): RpcChecksum | null =>
  checksum ? { algorithm: checksum.algorithm, value: checksum.value } : null

const toRpcMirror = (mirror: HttpMirror): RpcHttpMirror => ({
  url: mirror.url,
  priority: mirror.priority,
  headers: mirror.headers
    ? Object.fromEntries(
        Object.entries(mirror.headers).map(([key, value]) => [
          key,
          value.type === 'secretRef' ? { type: 'secretRef', secret_ref: value.secretRef } : value,
        ]),
      )
    : undefined,
})

const toRpcSource = (source: DownloadSource): RpcDownloadSource =>
  source.type === 'http'
    ? {
        type: 'http',
        mirrors: source.mirrors.map(toRpcMirror),
        expectedSize: source.expectedSize ?? null,
        etag: source.etag ?? null,
        lastModified: source.lastModified ?? null,
        expiresAt: source.expiresAt ?? null,
      }
    : {
        type: 'torrent',
        input: source.input,
        onlyFiles: source.onlyFiles,
        seedPolicy: toRpcSeedPolicy(source.seedPolicy),
      }

const toRpcSeedPolicy = (policy: SeedPolicy | undefined): RpcSeedPolicy | null => {
  if (!policy) return null
  switch (policy.mode) {
    case 'none':
      return policy
    case 'ratio':
      return { mode: 'ratio', ratio: policy.ratio }
    case 'duration':
      return { mode: 'duration', duration_seconds: policy.durationSeconds }
    case 'ratioOrDuration':
      return {
        mode: 'ratioOrDuration',
        ratio: policy.ratio,
        duration_seconds: policy.durationSeconds,
      }
  }
}

const toRpcRefreshContext = (
  context: ContentRefreshContext | undefined,
): RpcContentRefreshContext | null =>
  context
    ? {
        plugin: context.plugin,
        contentType: context.contentType,
        contentId: context.contentId,
        episodeId: context.episodeId,
        contentPageFingerprint: context.contentPageFingerprint ?? null,
        providerFingerprint: context.providerFingerprint,
        pluginVersion: context.pluginVersion ?? null,
        pluginIntegrity: context.pluginIntegrity ?? null,
      }
    : null

const toRpcAsset = (asset: DownloadAsset): RpcDownloadAsset => ({
  key: asset.key,
  relativePath: asset.relativePath,
  size: asset.size ?? null,
  checksum: toRpcChecksum(asset.checksum),
  source: toRpcSource(asset.source),
})

const toClientTaskUpsert = (event: RpcTaskUpsertEvent): TaskUpsertEvent => ({
  task: toClientTask(event.task),
  revision: event.revision,
})

const toClientTaskRemoved = (event: RpcTaskRemovedEvent): TaskRemovedEvent => ({
  taskId: event.taskId,
  revision: event.revision,
})

const toClientAttention = (event: RpcAttentionEvent): TaskAttention => ({
  taskId: event.taskId,
  code: event.code,
  message: event.message,
  revision: event.revision,
})

const toClientSource = (source: RpcDownloadSource): DownloadSource =>
  source.type === 'http'
    ? {
        type: 'http',
        mirrors: source.mirrors.map(mirror => ({
          url: mirror.url,
          priority: mirror.priority,
          headers: mirror.headers
            ? Object.fromEntries(
                Object.entries(mirror.headers).map(([key, value]) => [
                  key,
                  value.type === 'secretRef'
                    ? { type: 'secretRef', secretRef: value.secret_ref }
                    : value,
                ]),
              )
            : undefined,
        })),
        expectedSize: source.expectedSize ?? undefined,
        etag: source.etag ?? undefined,
        lastModified: source.lastModified ?? undefined,
        expiresAt: source.expiresAt ?? undefined,
      }
    : {
        type: 'torrent',
        input: source.input,
        onlyFiles: source.onlyFiles,
        seedPolicy:
          source.seedPolicy?.mode === 'duration'
            ? { mode: 'duration', durationSeconds: source.seedPolicy.duration_seconds }
            : source.seedPolicy?.mode === 'ratio'
              ? { mode: 'ratio', ratio: source.seedPolicy.ratio ?? 0 }
              : source.seedPolicy?.mode === 'ratioOrDuration'
                ? {
                    mode: 'ratioOrDuration',
                    ratio: source.seedPolicy.ratio ?? 0,
                    durationSeconds: source.seedPolicy.duration_seconds,
                  }
                : source.seedPolicy?.mode === 'none'
                  ? { mode: 'none' }
                  : undefined,
      }

const toClientTask = (task: RpcDownloadTask): DownloadTask => ({
  id: task.id,
  collectionKey: task.collectionKey ?? undefined,
  assetKey: task.assetKey ?? undefined,
  kind: task.kind,
  title: task.title,
  source: toClientSource(task.source),
  destinationId: task.destinationId,
  relativePath: task.relativePath,
  status: task.status,
  priority: task.priority,
  queuePosition: task.queuePosition,
  totalBytes: task.totalBytes ?? undefined,
  downloadedBytes: task.downloadedBytes,
  speedBytesPerSecond: task.speedBytesPerSecond,
  errorCode: task.errorCode ?? undefined,
  errorMessage: task.errorMessage ?? undefined,
  checksum: task.checksum ?? undefined,
  etag: task.etag ?? undefined,
  lastModified: task.lastModified ?? undefined,
  finalPath: task.finalPath ?? undefined,
  retryCount: task.retryCount,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
  revision: task.revision,
})

const toClientRefreshContext = (context: RpcContentRefreshContext): ContentRefreshContext => ({
  plugin: context.plugin,
  contentType: context.contentType,
  contentId: context.contentId,
  episodeId: context.episodeId,
  contentPageFingerprint: context.contentPageFingerprint ?? undefined,
  providerFingerprint: context.providerFingerprint,
  pluginVersion: context.pluginVersion ?? undefined,
  pluginIntegrity: context.pluginIntegrity ?? undefined,
})

const toClientCollection = (collection: RpcDownloadCollection): DownloadCollection => ({
  ...collection,
  refreshContext: collection.refreshContext
    ? toClientRefreshContext(collection.refreshContext)
    : undefined,
  totalBytes: collection.totalBytes ?? undefined,
})

const toClientTaskDetail = (detail: RpcDownloadTaskDetail): DownloadTaskDetail => ({
  task: toClientTask(detail.task),
  completedRanges: detail.completedRanges,
  torrent: detail.torrent
    ? {
        infoHash: detail.torrent.infoHash ?? undefined,
        uploadedBytes: detail.torrent.uploadedBytes,
        peerCount: detail.torrent.peerCount,
        seedStartedAt: detail.torrent.seedStartedAt ?? undefined,
      }
    : undefined,
})

const toClientSettings = (settings: RpcDownloaderSettings): DownloaderSettings => ({
  ...settings,
  seedRatio: settings.seedRatio ?? undefined,
  seedSeconds: settings.seedSeconds ?? undefined,
})

export interface CreateDownloaderOptions {
  key?: string
}

export class Downloader {
  static readonly #defaultKey = 'default'
  static readonly #instances = new Map<string, Downloader>()
  readonly #key: string
  readonly #subscriptions = new Set<DownloaderUnlisten>()
  #rpc: DownloaderRpc | undefined
  #disposed = false

  private constructor(key: string) {
    this.#key = key
  }

  /** Creates and registers a downloader instance under a stable runtime key. */
  static create(options: CreateDownloaderOptions = {}): Downloader {
    const key = this.#normalizeKey(options.key)
    if (this.#instances.has(key)) {
      throw new Error(`downloader instance already exists: ${key}`)
    }
    const downloader = new Downloader(key)
    this.#instances.set(key, downloader)
    return downloader
  }

  /** Returns the registered instance, lazily creating the default Tauri client when absent. */
  static get(key = this.#defaultKey): Downloader {
    const normalizedKey = this.#normalizeKey(key)
    return this.#instances.get(normalizedKey) ?? this.create({ key: normalizedKey })
  }

  static #normalizeKey(key = this.#defaultKey): string {
    const normalized = key.trim()
    if (!normalized) throw new TypeError('downloader instance key must not be empty')
    return normalized
  }

  #getRpc(): DownloaderRpc {
    this.#assertActive()
    return (this.#rpc ??= createTauRPCProxy().downloader)
  }

  get key(): string {
    return this.#key
  }

  /** Removes native event listeners and unregisters this instance. */
  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    const subscriptions = [...this.#subscriptions]
    this.#subscriptions.clear()
    if (Downloader.#instances.get(this.#key) === this) Downloader.#instances.delete(this.#key)

    for (const unlisten of subscriptions) unlisten()
  }

  /**
   * Downloads a short-lived resource without creating a managed task or task events.
   * The native backend removes all temporary state on success, cancellation, and failure.
   */
  async downloadEphemeral(
    url: string,
    options: DownloadEphemeralOptions = {},
  ): Promise<Uint8Array<ArrayBuffer>> {
    const bytes = await this.#getRpc().download_ephemeral(
      url,
      options.headers ?? null,
      options.secretRef ?? null,
      options.maxBytes ?? null,
    )
    return Uint8Array.from(bytes)
  }

  /** Stores a header, cookie, or token in the operating system credential vault. */
  async storeSecret(value: string): Promise<string> {
    return await this.#getRpc().store_secret(value)
  }

  /** Deletes a native credential reference. Deletion is idempotent. */
  async deleteSecret(secretRef: string): Promise<void> {
    await this.#getRpc().delete_secret(secretRef)
  }

  async listTasks(): Promise<DownloadTask[]> {
    return (await this.#getRpc().list_tasks()).map(toClientTask)
  }

  async getTaskDetail(id: string): Promise<DownloadTaskDetail> {
    return toClientTaskDetail(await this.#getRpc().get_task_detail(id))
  }

  async getCollections(): Promise<DownloadCollection[]> {
    return (await this.#getRpc().get_collections()).map(toClientCollection)
  }

  async listDestinations(): Promise<Destination[]> {
    return await this.#getRpc().list_destinations()
  }

  async getSettings(): Promise<DownloaderSettings> {
    return toClientSettings(await this.#getRpc().get_settings())
  }

  async getCapabilities(): Promise<DownloaderCapabilities> {
    return await this.#getRpc().get_capabilities()
  }

  async updateSettings(
    patch: Partial<Omit<DownloaderSettings, 'revision'>>,
  ): Promise<DownloaderSettings> {
    const settings = { ...(await this.getSettings()), ...patch }
    return toClientSettings(
      await this.#getRpc().update_settings({
        ...settings,
        seedRatio: settings.seedRatio ?? null,
        seedSeconds: settings.seedSeconds ?? null,
      }),
    )
  }

  async enqueueUrl(input: EnqueueUrlInput): Promise<DownloadTask> {
    return toClientTask(
      await this.#getRpc().enqueue_url({
        url: input.url,
        mirrors: input.mirrors?.map(toRpcMirror),
        title: input.title ?? null,
        relativePath: input.relativePath ?? null,
        destinationId: input.destinationId ?? null,
        priority: input.priority ?? null,
        checksum: toRpcChecksum(input.checksum),
      }),
    )
  }

  async enqueueTorrent(input: EnqueueTorrentInput): Promise<DownloadTask> {
    return toClientTask(
      await this.#getRpc().enqueue_torrent({
        source: {
          input: input.source.input,
          onlyFiles: input.source.onlyFiles,
          seedPolicy: toRpcSeedPolicy(input.source.seedPolicy),
        },
        title: input.title ?? null,
        relativePath: input.relativePath ?? null,
        destinationId: input.destinationId ?? null,
        priority: input.priority ?? null,
      }),
    )
  }

  async enqueuePlan(input: EnqueuePlanInput): Promise<DownloadTask[]> {
    const tasks = await this.#getRpc().enqueue_plan({
      key: input.key,
      title: input.title,
      assets: input.assets.map(toRpcAsset),
      destinationId: input.destinationId ?? null,
      priority: input.priority ?? null,
      refreshContext: toRpcRefreshContext(input.refreshContext),
    })
    return tasks.map(toClientTask)
  }

  async pauseTask(id: string): Promise<DownloadTask> {
    return toClientTask(await this.#getRpc().pause_task(id))
  }

  async resumeTask(id: string): Promise<DownloadTask> {
    return toClientTask(await this.#getRpc().resume_task(id))
  }

  async retryTask(id: string): Promise<DownloadTask> {
    return toClientTask(await this.#getRpc().retry_task(id))
  }

  async cancelTask(id: string): Promise<DownloadTask> {
    return toClientTask(await this.#getRpc().cancel_task(id))
  }

  async forgetTask(id: string): Promise<void> {
    await this.#getRpc().forget_task(id)
  }

  async deleteTaskFiles(id: string): Promise<void> {
    await this.#getRpc().delete_task_files(id)
  }

  async setPriority(id: string, priority: number): Promise<DownloadTask> {
    return toClientTask(await this.#getRpc().set_priority(id, priority))
  }

  async moveQueue(id: string, beforeTaskId?: string | null): Promise<DownloadTask> {
    return toClientTask(await this.#getRpc().move_queue(id, beforeTaskId ?? null))
  }

  /** Opens the platform-owned directory picker and registers the granted destination. */
  async pickDestination(): Promise<Destination | null> {
    return await this.#getRpc().pick_destination()
  }

  async updateSource(id: string, source: DownloadSource): Promise<DownloadTask> {
    return toClientTask(await this.#getRpc().update_source(id, toRpcSource(source)))
  }

  async onTaskUpsert(handler: (event: TaskUpsertEvent) => void): Promise<DownloaderUnlisten> {
    return await this.#subscribe(
      listener => this.#getRpc().task_upsert.on(event => listener(toClientTaskUpsert(event))),
      handler,
    )
  }

  async onTaskRemoved(handler: (event: TaskRemovedEvent) => void): Promise<DownloaderUnlisten> {
    return await this.#subscribe(
      listener => this.#getRpc().task_removed.on(event => listener(toClientTaskRemoved(event))),
      handler,
    )
  }

  async onAttention(handler: (event: TaskAttention) => void): Promise<DownloaderUnlisten> {
    return await this.#subscribe(
      listener => this.#getRpc().attention.on(event => listener(toClientAttention(event))),
      handler,
    )
  }

  async listen(handlers: DownloaderEventHandlers): Promise<DownloaderUnlisten> {
    const subscriptions: DownloaderUnlisten[] = []
    try {
      if (handlers.upsert) subscriptions.push(await this.onTaskUpsert(handlers.upsert))
      if (handlers.removed) subscriptions.push(await this.onTaskRemoved(handlers.removed))
      if (handlers.attention) subscriptions.push(await this.onAttention(handlers.attention))
    } catch (error) {
      for (const unlisten of subscriptions) unlisten()
      throw error
    }
    let active = true
    return () => {
      if (!active) return
      active = false
      for (const unlisten of subscriptions) unlisten()
    }
  }

  async #subscribe<T>(
    subscribe: (handler: (event: T) => void) => Promise<DownloaderUnlisten>,
    handler: (event: T) => void,
  ): Promise<DownloaderUnlisten> {
    this.#assertActive()
    const nativeUnlisten = await subscribe(handler)
    if (this.#disposed) {
      nativeUnlisten()
      throw new Error(`downloader instance is disposed: ${this.#key}`)
    }
    let active = true
    const unlisten = () => {
      if (!active) return
      active = false
      this.#subscriptions.delete(unlisten)
      nativeUnlisten()
    }
    this.#subscriptions.add(unlisten)
    return unlisten
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error(`downloader instance is disposed: ${this.#key}`)
  }
}