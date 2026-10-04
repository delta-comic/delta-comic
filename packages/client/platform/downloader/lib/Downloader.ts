import { createTauRPCProxy } from './bindings'
import type {
  AttentionEvent as RpcAttentionEvent,
  Checksum as RpcChecksum,
  ContentRefreshContext as RpcContentRefreshContext,
  DownloadAsset as RpcDownloadAsset,
  DownloadSource as RpcDownloadSource,
  DownloadTask as RpcDownloadTask,
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

export interface CreateDownloaderOptions {
  key?: string
  rpc?: DownloaderRpc
}

export class Downloader {
  static readonly #defaultKey = 'default'
  static readonly #instances = new Map<string, Downloader>()
  static #createRpc(): DownloaderRpc {
    return createTauRPCProxy().downloader
  }

  readonly #key: string
  readonly #subscriptions = new Set<DownloaderUnlisten>()
  #rpc: DownloaderRpc | undefined
  #disposed = false

  private constructor(key: string, rpc?: DownloaderRpc) {
    this.#key = key
    this.#rpc = rpc
  }

  /** Creates and registers a downloader instance under a stable runtime key. */
  static create(options: CreateDownloaderOptions = {}): Downloader {
    const key = this.#normalizeKey(options.key)
    if (this.#instances.has(key)) {
      throw new Error(`downloader instance already exists: ${key}`)
    }
    const downloader = new Downloader(key, options.rpc)
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
    return (this.#rpc ??= Downloader.#createRpc())
  }

  get key(): string {
    return this.#key
  }

  /** Removes native event listeners and unregisters this instance. Safe to call repeatedly. */
  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    const subscriptions = [...this.#subscriptions]
    this.#subscriptions.clear()
    if (Downloader.#instances.get(this.#key) === this) Downloader.#instances.delete(this.#key)

    const errors: unknown[] = []
    for (const unlisten of subscriptions) {
      try {
        unlisten()
      } catch (error) {
        errors.push(error)
      }
    }
    if (errors.length) {
      throw new AggregateError(errors, `failed to dispose downloader instance: ${this.#key}`)
    }
  }

  /**
   * Downloads a short-lived resource without creating a managed task or task events.
   * The native backend removes all temporary state on success, cancellation, and failure.
   */
  async downloadEphemeral(
    url: string,
    options: DownloadEphemeralOptions = {},
  ): Promise<Uint8Array<ArrayBuffer>> {
    const bytes = await this.#request(() =>
      this.#getRpc().download_ephemeral(
        url,
        options.headers ?? null,
        options.secretRef ?? null,
        options.maxBytes ?? null,
      ),
    )
    return Downloader.#normalizeRawBytes(bytes)
  }

  /** Stores a header, cookie, or token in the operating system credential vault. */
  async storeSecret(value: string): Promise<string> {
    return await this.#request(() => this.#getRpc().store_secret(value))
  }

  /** Deletes a native credential reference. Deletion is idempotent. */
  async deleteSecret(secretRef: string): Promise<void> {
    await this.#request(() => this.#getRpc().delete_secret(secretRef))
  }

  async listTasks(): Promise<DownloadTask[]> {
    return (await this.#request(() => this.#getRpc().list_tasks())) as DownloadTask[]
  }

  async getTask(id: string): Promise<DownloadTask | null> {
    return (await this.#request(() => this.#getRpc().get_task(id))) as DownloadTask | null
  }

  async getTaskDetail(id: string): Promise<DownloadTaskDetail> {
    return (await this.#request(() => this.#getRpc().get_task_detail(id))) as DownloadTaskDetail
  }

  async getCollections(): Promise<DownloadCollection[]> {
    return (await this.#request(() => this.#getRpc().get_collections())) as DownloadCollection[]
  }

  async listDestinations(): Promise<Destination[]> {
    return (await this.#request(() => this.#getRpc().list_destinations())) as Destination[]
  }

  async getSettings(): Promise<DownloaderSettings> {
    return (await this.#request(() => this.#getRpc().get_settings())) as DownloaderSettings
  }

  async getCapabilities(): Promise<DownloaderCapabilities> {
    return (await this.#request(() => this.#getRpc().get_capabilities())) as DownloaderCapabilities
  }

  async updateSettings(
    patch: Partial<Omit<DownloaderSettings, 'revision'>>,
  ): Promise<DownloaderSettings> {
    const settings = { ...(await this.getSettings()), ...patch }
    return (await this.#request(() =>
      this.#getRpc().update_settings({
        ...settings,
        seedRatio: settings.seedRatio ?? null,
        seedSeconds: settings.seedSeconds ?? null,
      }),
    )) as DownloaderSettings
  }

  async enqueueUrl(input: EnqueueUrlInput): Promise<DownloadTask> {
    return (await this.#request(() =>
      this.#getRpc().enqueue_url({
        url: input.url,
        mirrors: input.mirrors?.map(toRpcMirror),
        title: input.title ?? null,
        relativePath: input.relativePath ?? null,
        destinationId: input.destinationId ?? null,
        priority: input.priority ?? null,
        checksum: toRpcChecksum(input.checksum),
      }),
    )) as DownloadTask
  }

  async enqueueTorrent(input: EnqueueTorrentInput): Promise<DownloadTask> {
    return (await this.#request(() =>
      this.#getRpc().enqueue_torrent({
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
    )) as DownloadTask
  }

  async enqueuePlan(input: EnqueuePlanInput): Promise<DownloadTask[]> {
    return (await this.#request(() =>
      this.#getRpc().enqueue_plan({
        key: input.key,
        title: input.title,
        assets: input.assets.map(toRpcAsset),
        destinationId: input.destinationId ?? null,
        priority: input.priority ?? null,
        refreshContext: toRpcRefreshContext(input.refreshContext),
      }),
    )) as DownloadTask[]
  }

  async pauseTask(id: string): Promise<DownloadTask> {
    return (await this.#request(() => this.#getRpc().pause_task(id))) as DownloadTask
  }

  async resumeTask(id: string): Promise<DownloadTask> {
    return (await this.#request(() => this.#getRpc().resume_task(id))) as DownloadTask
  }

  async retryTask(id: string): Promise<DownloadTask> {
    return (await this.#request(() => this.#getRpc().retry_task(id))) as DownloadTask
  }

  async cancelTask(id: string): Promise<DownloadTask> {
    return (await this.#request(() => this.#getRpc().cancel_task(id))) as DownloadTask
  }

  async forgetTask(id: string): Promise<void> {
    await this.#request(() => this.#getRpc().forget_task(id))
  }

  async deleteTaskFiles(id: string): Promise<void> {
    await this.#request(() => this.#getRpc().delete_task_files(id))
  }

  async setPriority(id: string, priority: number): Promise<DownloadTask> {
    return (await this.#request(() => this.#getRpc().set_priority(id, priority))) as DownloadTask
  }

  async moveQueue(id: string, beforeTaskId?: string | null): Promise<DownloadTask> {
    return (await this.#request(() =>
      this.#getRpc().move_queue(id, beforeTaskId ?? null),
    )) as DownloadTask
  }

  /** Opens the platform-owned directory picker and registers the granted destination. */
  async pickDestination(): Promise<Destination | null> {
    return (await this.#request(() => this.#getRpc().pick_destination())) as Destination | null
  }

  async updateSource(id: string, source: DownloadSource): Promise<DownloadTask> {
    return (await this.#request(() =>
      this.#getRpc().update_source(id, toRpcSource(source)),
    )) as DownloadTask
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

  async #request<T>(request: () => Promise<T>): Promise<T> {
    this.#assertActive()
    return await request()
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

  static #normalizeRawBytes(
    value: ArrayBuffer | Uint8Array | readonly number[],
  ): Uint8Array<ArrayBuffer> {
    if (value instanceof ArrayBuffer) return new Uint8Array(value)
    if (value instanceof Uint8Array) return Uint8Array.from(value)
    if (Array.isArray(value)) return Uint8Array.from(value)
    throw new TypeError('downloader returned an invalid ephemeral response')
  }
}