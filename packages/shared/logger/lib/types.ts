export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error'] as const

export type LogLevel = (typeof LOG_LEVELS)[number]

export interface LogEntry {
  timestamp: string
  scope: string
  level: LogLevel
  content: string
}

export interface LoggerTransport {
  write(entries: readonly LogEntry[]): void
  flush(): Promise<void>
  dispose(): Promise<void>
}

export interface LoggerOptions {
  minLevel?: LogLevel
  transport?: LoggerTransport
  captureErrors?: boolean
  flushOnLifecycle?: boolean
}