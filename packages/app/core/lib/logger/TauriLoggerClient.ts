import type { LogEntry, LoggerTransport } from '@delta-comic/logger'

import { createTauRPCProxy } from './bindings'

interface LogFileInfo {
  name: string
  path: string
  size: number
  modifiedAt: string
  archived: boolean
}

interface LogFileContent {
  path: string
  content: string
  size: number
  truncated: boolean
}

interface ExportLogsOptions {
  paths?: string[]
}

type LoggerRpc = ReturnType<typeof createTauRPCProxy>['logger']

interface TauriLoggerOptions {
  batchSize?: number
  flushIntervalMs?: number
  maxQueueSize?: number
  rpc?: LoggerRpc
  native?: boolean
  forwardToNative?: boolean
}

const isTauriRuntime = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Batched, non-blocking client for the native logger plugin. */
export class TauriLoggerClient implements LoggerTransport {
  public readonly native: boolean
  public readonly forwardToNative: boolean
  private readonly batchSize: number
  private readonly flushIntervalMs: number
  private readonly maxQueueSize: number
  private readonly rpc: LoggerRpc
  private queue: LogEntry[] = []
  private timer?: ReturnType<typeof setTimeout>
  private inFlight?: Promise<void>
  private disposed = false

  constructor(options: TauriLoggerOptions = {}) {
    this.native = options.native ?? (Boolean(options.rpc) || isTauriRuntime())
    this.forwardToNative = options.forwardToNative ?? true
    this.rpc = options.rpc ?? createTauRPCProxy().logger
    this.batchSize = Math.max(1, options.batchSize ?? 64)
    this.flushIntervalMs = Math.max(0, options.flushIntervalMs ?? 40)
    this.maxQueueSize = Math.max(this.batchSize, options.maxQueueSize ?? 4096)
  }

  public write(entries: readonly LogEntry[]): void {
    if (!this.native || !this.forwardToNative || this.disposed || entries.length === 0) return
    const remaining = this.maxQueueSize - this.queue.length
    if (remaining > 0) this.queue.push(...entries.slice(-remaining))
    if (this.queue.length >= this.batchSize) void this.flush()
    else this.scheduleFlush()
  }

  public async flush(): Promise<void> {
    this.clearTimer()
    if (!this.native || !this.forwardToNative) return
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
    this.assertNative()
    return this.rpc.list_log_files()
  }

  public async readLogFile(path: string): Promise<LogFileContent> {
    this.assertNative()
    return this.rpc.read_log_file(path)
  }

  public async exportLogs(options: ExportLogsOptions = {}): Promise<string> {
    this.assertNative()
    return this.rpc.export_logs(options.paths ?? null)
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
    await this.rpc.write_logs(entries)
  }

  private assertNative(): void {
    if (!this.native) throw new Error('Native logger operations are unavailable in a web browser')
  }
}