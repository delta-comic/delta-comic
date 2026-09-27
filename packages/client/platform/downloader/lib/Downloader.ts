import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

import type {
  Destination,
  DownloadCollection,
  DownloadEphemeralOptions,
  DownloaderCapabilities,
  DownloaderEventHandlers,
  DownloaderSettings,
  DownloadSource,
  DownloadTask,
  DownloadTaskDetail,
  EnqueuePlanInput,
  EnqueueTorrentInput,
  EnqueueUrlInput,
  TaskAttention,
  TaskRemovedEvent,
  TaskUpsertEvent,
} from './types'

export interface DownloaderTransport {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
  listen<T>(event: string, handler: (payload: T) => void): Promise<DownloaderUnlisten>
}

export type DownloaderUnlisten = () => void

export interface CreateDownloaderOptions {
  key?: string
  transport?: DownloaderTransport
}

export class Downloader {
  static readonly #defaultKey = 'default'
  static readonly #instances = new Map<string, Downloader>()
  static readonly #tauriTransport: DownloaderTransport = {
    invoke: async <T>(command: string, args?: Record<string, unknown>) =>
      await invoke<T>(command, args),
    listen: async <T>(event: string, handler: (payload: T) => void) =>
      await listen<T>(event, ({ payload }) => handler(payload)),
  }

  readonly #key: string
  readonly #subscriptions = new Set<DownloaderUnlisten>()
  readonly #transport: DownloaderTransport
  #disposed = false

  private constructor(key: string, transport: DownloaderTransport) {
    this.#key = key
    this.#transport = transport
  }

  /** Creates and registers a downloader instance under a stable runtime key. */
  static create(options: CreateDownloaderOptions = {}): Downloader {
    const key = this.#normalizeKey(options.key)
    if (this.#instances.has(key)) {
      throw new Error(`downloader instance already exists: ${key}`)
    }
    const downloader = new Downloader(key, options.transport ?? this.#tauriTransport)
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
    const bytes = await this.#command<ArrayBuffer | Uint8Array | number[]>('download_ephemeral', {
      url,
      ...options,
    })
    return Downloader.#normalizeRawBytes(bytes)
  }

  /** Stores a header, cookie, or token in the operating system credential vault. */
  async storeSecret(value: string): Promise<string> {
    return await this.#command('store_secret', { value })
  }

  /** Deletes a native credential reference. Deletion is idempotent. */
  async deleteSecret(secretRef: string): Promise<void> {
    await this.#command('delete_secret', { secretRef })
  }

  async listTasks(): Promise<DownloadTask[]> {
    return await this.#command('list_tasks')
  }

  async getTask(id: string): Promise<DownloadTask | null> {
    return await this.#command('get_task', { id })
  }

  async getTaskDetail(id: string): Promise<DownloadTaskDetail> {
    return await this.#command('get_task_detail', { id })
  }

  async getCollections(): Promise<DownloadCollection[]> {
    return await this.#command('get_collections')
  }

  async listDestinations(): Promise<Destination[]> {
    return await this.#command('list_destinations')
  }

  async getSettings(): Promise<DownloaderSettings> {
    return await this.#command('get_settings')
  }

  async getCapabilities(): Promise<DownloaderCapabilities> {
    return await this.#command('get_capabilities')
  }

  async updateSettings(
    patch: Partial<Omit<DownloaderSettings, 'revision'>>,
  ): Promise<DownloaderSettings> {
    const settings = { ...(await this.getSettings()), ...patch }
    return await this.#command('update_settings', { settings })
  }

  async enqueueUrl(input: EnqueueUrlInput): Promise<DownloadTask> {
    return await this.#command('enqueue_url', { input })
  }

  async enqueueTorrent(input: EnqueueTorrentInput): Promise<DownloadTask> {
    return await this.#command('enqueue_torrent', { input })
  }

  async enqueuePlan(input: EnqueuePlanInput): Promise<DownloadTask[]> {
    return await this.#command('enqueue_plan', { input })
  }

  async pauseTask(id: string): Promise<DownloadTask> {
    return await this.#command('pause_task', { id })
  }

  async resumeTask(id: string): Promise<DownloadTask> {
    return await this.#command('resume_task', { id })
  }

  async retryTask(id: string): Promise<DownloadTask> {
    return await this.#command('retry_task', { id })
  }

  async cancelTask(id: string): Promise<DownloadTask> {
    return await this.#command('cancel_task', { id })
  }

  async forgetTask(id: string): Promise<void> {
    await this.#command('forget_task', { id })
  }

  async deleteTaskFiles(id: string): Promise<void> {
    await this.#command('delete_task_files', { id })
  }

  async setPriority(id: string, priority: number): Promise<DownloadTask> {
    return await this.#command('set_priority', { id, priority })
  }

  async moveQueue(id: string, beforeTaskId?: string | null): Promise<DownloadTask> {
    return await this.#command('move_queue', { id, beforeTaskId })
  }

  /** Opens the platform-owned directory picker and registers the granted destination. */
  async pickDestination(): Promise<Destination | null> {
    return await this.#command('pick_destination')
  }

  async updateSource(id: string, source: DownloadSource): Promise<DownloadTask> {
    return await this.#command('update_source', { id, source })
  }

  async onTaskUpsert(handler: (event: TaskUpsertEvent) => void): Promise<DownloaderUnlisten> {
    return await this.#listen('downloader://task-upsert', handler)
  }

  async onTaskRemoved(handler: (event: TaskRemovedEvent) => void): Promise<DownloaderUnlisten> {
    return await this.#listen('downloader://task-removed', handler)
  }

  async onAttention(handler: (event: TaskAttention) => void): Promise<DownloaderUnlisten> {
    return await this.#listen('downloader://attention', handler)
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

  async #command<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    this.#assertActive()
    return await this.#transport.invoke<T>(`plugin:downloader|${name}`, args)
  }

  async #listen<T>(event: string, handler: (event: T) => void): Promise<DownloaderUnlisten> {
    this.#assertActive()
    const nativeUnlisten = await this.#transport.listen<T>(event, handler)
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