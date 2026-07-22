export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error'] as const

export type LogLevel = (typeof LOG_LEVELS)[number]

export interface LogEntry {
  /** ISO-8601 timestamp generated at the call site. */
  timestamp: string
  scope: string
  level: LogLevel
  /** A cycle-safe, JSON-like rendering of all arguments. */
  content: string
}

export interface LogFileInfo {
  name: string
  path: string
  size: number
  modifiedAt: string
  archived: boolean
}

export interface LogFileContent {
  path: string
  content: string
  size: number
  /** True when only the most recent portion of a large file was returned. */
  truncated: boolean
}

export interface ExportLogsOptions {
  /** Omit to export every active and archived log file. */
  paths?: string[]
}

export type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>

export interface LoggerClient {
  readonly native: boolean
  write(entries: readonly LogEntry[]): void
  flush(): Promise<void>
  listLogFiles(): Promise<LogFileInfo[]>
  readLogFile(path: string): Promise<LogFileContent>
  exportLogs(options?: ExportLogsOptions): Promise<string>
  dispose(): Promise<void>
}

export interface LoggerOptions {
  /** Defaults to `trace` in development and `info` in production. */
  minLevel?: LogLevel
  /** Maximum entries sent in one invoke call. */
  batchSize?: number
  /** Maximum delay before a partial batch is sent. */
  flushIntervalMs?: number
  /** Bounds memory use if the native side becomes unavailable. */
  maxQueueSize?: number
  /** Supplies an invoke implementation for alternate hosts and tests. */
  invoke?: Invoke
  /** Override automatic Tauri detection. */
  native?: boolean
  /** Captures `error` and `unhandledrejection` events. Defaults to true. */
  captureErrors?: boolean
  /** Flushes on page hide/visibility changes. Defaults to true. */
  flushOnLifecycle?: boolean
}