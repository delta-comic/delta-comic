import type {
  ExportLogsOptions,
  Invoke,
  LogEntry,
  LogFileContent,
  LogFileInfo,
  LoggerClient,
  LoggerOptions,
} from './types'

const COMMAND_PREFIX = 'plugin:logger|'

const isTauriRuntime = () => {
  if (typeof window === 'undefined') return false
  return '__TAURI_INTERNALS__' in window
}

const loadTauriInvoke = async (): Promise<Invoke> => {
  const { invoke } = await import('@tauri-apps/api/core')
  return (command, args) => invoke(command, args)
}

/** Batched, non-blocking client for the native logger plugin. */
export class TauriLoggerClient implements LoggerClient {
  public readonly native: boolean
  private readonly batchSize: number
  private readonly flushIntervalMs: number
  private readonly maxQueueSize: number
  private readonly configuredInvoke?: Invoke
  private invokePromise?: Promise<Invoke>
  private queue: LogEntry[] = []
  private timer?: ReturnType<typeof setTimeout>
  private inFlight?: Promise<void>
  private disposed = false

  constructor(options: LoggerOptions = {}) {
    this.native = options.native ?? (Boolean(options.invoke) || isTauriRuntime())
    this.configuredInvoke = options.invoke
    this.batchSize = Math.max(1, options.batchSize ?? 64)
    this.flushIntervalMs = Math.max(0, options.flushIntervalMs ?? 40)
    this.maxQueueSize = Math.max(this.batchSize, options.maxQueueSize ?? 4096)
  }

  public write(entries: readonly LogEntry[]): void {
    if (!this.native || this.disposed || entries.length === 0) return
    const remaining = this.maxQueueSize - this.queue.length
    if (remaining > 0) this.queue.push(...entries.slice(-remaining))
    if (this.queue.length >= this.batchSize) void this.flush()
    else this.scheduleFlush()
  }

  public async flush(): Promise<void> {
    this.clearTimer()
    if (!this.native) return
    if (this.inFlight) {
      await this.inFlight
      if (this.queue.length > 0) await this.flush()
      return
    }
    const entries = this.queue.splice(0, this.batchSize)
    if (entries.length === 0) return
    const task = this.send(entries)
    this.inFlight = task
    try {
      await task
    } catch {
      // Logging must never surface a transport failure as an unhandled rejection or break the app.
    } finally {
      this.inFlight = undefined
    }
    if (this.queue.length > 0) await this.flush()
  }

  public async listLogFiles(): Promise<LogFileInfo[]> {
    return this.call<LogFileInfo[]>('list_log_files')
  }

  public async readLogFile(path: string): Promise<LogFileContent> {
    return this.call<LogFileContent>('read_log_file', { path })
  }

  public async exportLogs(options: ExportLogsOptions = {}): Promise<string> {
    return this.call<string>('export_logs', { paths: options.paths })
  }

  public async dispose(): Promise<void> {
    if (this.disposed) return
    await this.flush()
    this.disposed = true
    this.clearTimer()
  }

  private scheduleFlush(): void {
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = undefined
      void this.flush()
    }, this.flushIntervalMs)
  }

  private clearTimer(): void {
    if (!this.timer) return
    clearTimeout(this.timer)
    this.timer = undefined
  }

  private async send(entries: LogEntry[]): Promise<void> {
    await this.call<void>('write_logs', { entries })
  }

  private async call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    if (!this.native) throw new Error('Native logger operations are unavailable in a web browser')
    const invoke = await this.resolveInvoke()
    return invoke(`${COMMAND_PREFIX}${command}`, args) as Promise<T>
  }

  private resolveInvoke(): Promise<Invoke> {
    this.invokePromise ??= this.configuredInvoke
      ? Promise.resolve(this.configuredInvoke)
      : loadTauriInvoke()
    return this.invokePromise
  }
}