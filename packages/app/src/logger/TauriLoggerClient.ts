import {
  createTauRPCProxy,
  type LogEntry,
  type LoggerTransport,
  type LogFileInfo,
  type LogFileContent,
} from '@delta-comic/platform/logger'
import { isTauri } from '@tauri-apps/api/core'

interface ExportLogsOptions {
  paths?: string[]
}

/** Batched, non-blocking client for the native logger plugin. */
export class TauriLoggerClient implements LoggerTransport {
  private readonly native = isTauri()
  private readonly batchSize = 64
  private readonly flushIntervalMs = 40
  private readonly maxQueueSize = 4096
  private readonly rpc = createTauRPCProxy().logger
  private queue: LogEntry[] = []
  private timer?: ReturnType<typeof setTimeout>
  private inFlight?: Promise<void>
  private disposed = false

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
    const task = this.rpc.write_logs(entries).then(() => {})
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
    return this.rpc.list_log_files()
  }

  public async readLogFile(path: string): Promise<LogFileContent> {
    return this.rpc.read_log_file(path)
  }

  public async exportLogs(options: ExportLogsOptions = {}): Promise<string> {
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
}