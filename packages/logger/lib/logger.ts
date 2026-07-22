import { TauriLoggerClient } from './client'
import { serializeLogArguments } from './serializer'
import {
  LOG_LEVELS,
  type ExportLogsOptions,
  type LogEntry,
  type LogFileContent,
  type LogFileInfo,
  type LogLevel,
  type LoggerClient,
  type LoggerOptions,
} from './types'

type ConsoleMethod = 'debug' | 'error' | 'info' | 'log' | 'trace' | 'warn'
type ConsoleWriter = (...values: unknown[]) => void

const CONSOLE_LEVEL: Record<ConsoleMethod, LogLevel> = {
  debug: 'debug',
  error: 'error',
  info: 'info',
  log: 'info',
  trace: 'trace',
  warn: 'warn',
}

const LEVEL_CONSOLE: Record<LogLevel, ConsoleMethod> = {
  trace: 'trace',
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
}

const isDevelopment = (): boolean => {
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean; PROD?: boolean } }).env
  return env?.DEV === true || env?.PROD === false
}

const levelValue = (level: LogLevel) => LOG_LEVELS.indexOf(level)

const resolveMinLevel = (requested?: LogLevel): LogLevel => {
  const level = requested ?? (isDevelopment() ? 'trace' : 'info')
  return !isDevelopment() && levelValue(level) < levelValue('info') ? 'info' : level
}

const normalizeScope = (scope: string) => scope.trim() || 'app'

const joinScope = (parent: string, child: string) => {
  const normalizedChild = child.trim()
  return normalizedChild ? `${parent}:${normalizedChild}` : parent
}

const pad = (value: number) => String(value).padStart(2, '0')

export const formatLogEntry = (entry: LogEntry): string => {
  const date = new Date(entry.timestamp)
  const timestamp = Number.isNaN(date.getTime())
    ? entry.timestamp
    : `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  return `[${timestamp}] (${entry.scope}) ${entry.level} > ${entry.content}`
}

interface LoggerRuntime {
  client: LoggerClient
  minLevel: LogLevel
  consoleWriters: Record<ConsoleMethod, ConsoleWriter>
  cleanup: Set<() => void>
  consoleRestore?: () => void
  errorCaptureInstalled: boolean
  lifecycleInstalled: boolean
}

/** Scoped logger shared by the app, plugins, and regular web builds. */
export class Logger {
  private readonly runtime: LoggerRuntime

  constructor(
    public readonly scope = 'app',
    options: LoggerOptions = {},
  ) {
    this.scope = normalizeScope(scope)
    this.runtime = {
      client: new TauriLoggerClient(options),
      minLevel: resolveMinLevel(options.minLevel),
      consoleWriters: this.captureConsole(),
      cleanup: new Set(),
      errorCaptureInstalled: false,
      lifecycleInstalled: false,
    }
    if (options.captureErrors !== false) this.captureGlobalErrors()
    if (options.flushOnLifecycle !== false) this.flushOnLifecycle()
  }

  private static fromRuntime(scope: string, runtime: LoggerRuntime): Logger {
    const logger = Object.create(Logger.prototype) as Logger
    Object.defineProperty(logger, 'scope', { enumerable: true, value: scope })
    Object.defineProperty(logger, 'runtime', { value: runtime })
    return logger
  }

  public get client(): LoggerClient {
    return this.runtime.client
  }

  public get minLevel(): LogLevel {
    return this.runtime.minLevel
  }

  public set minLevel(level: LogLevel) {
    this.runtime.minLevel = resolveMinLevel(level)
  }

  public scoped(scope: string): Logger {
    return Logger.fromRuntime(joinScope(this.scope, scope), this.runtime)
  }

  public group(scope: string): Logger {
    return this.scoped(scope)
  }

  public trace(...values: unknown[]): void {
    this.emit('trace', values)
  }

  public debug(...values: unknown[]): void {
    this.emit('debug', values)
  }

  public info(...values: unknown[]): void {
    this.emit('info', values)
  }

  public warn(...values: unknown[]): void {
    this.emit('warn', values)
  }

  public error(...values: unknown[]): void {
    this.emit('error', values)
  }

  /** Copies console output into this logger while retaining the original output. */
  public proxyConsole(): () => void {
    if (this.runtime.consoleRestore) return this.runtime.consoleRestore
    if (typeof console === 'undefined') return () => undefined
    let writing = false
    const restores: Array<() => void> = []
    for (const method of Object.keys(CONSOLE_LEVEL) as ConsoleMethod[]) {
      const previous = console[method] as ConsoleWriter
      const original = this.runtime.consoleWriters[method]
      const proxy = (...values: unknown[]) => {
        original(...values)
        if (writing) return
        writing = true
        try {
          this.emit(CONSOLE_LEVEL[method], values, false)
        } finally {
          writing = false
        }
      }
      console[method] = proxy as (typeof console)[typeof method]
      restores.push(() => {
        if (console[method] === proxy) console[method] = previous as never
      })
    }
    const restore = () => {
      for (const callback of restores) callback()
      if (this.runtime.consoleRestore === restore) this.runtime.consoleRestore = undefined
    }
    this.runtime.consoleRestore = restore
    return restore
  }

  public captureGlobalErrors(): () => void {
    if (this.runtime.errorCaptureInstalled || typeof window === 'undefined') return () => undefined
    const onError = (event: ErrorEvent) => {
      this.emit('error', ['Uncaught error', event.error ?? event.message], true)
    }
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      this.emit('error', ['Unhandled promise rejection', event.reason], true)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    this.runtime.errorCaptureInstalled = true
    const cleanup = () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
      this.runtime.errorCaptureInstalled = false
      this.runtime.cleanup.delete(cleanup)
    }
    this.runtime.cleanup.add(cleanup)
    return cleanup
  }

  public flushOnLifecycle(): () => void {
    if (this.runtime.lifecycleInstalled || typeof window === 'undefined') return () => undefined
    const flush = () => void this.flush()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onVisibilityChange)
    this.runtime.lifecycleInstalled = true
    const cleanup = () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      this.runtime.lifecycleInstalled = false
      this.runtime.cleanup.delete(cleanup)
    }
    this.runtime.cleanup.add(cleanup)
    return cleanup
  }

  public flush(): Promise<void> {
    return this.runtime.client.flush()
  }

  public async dispose(): Promise<void> {
    this.runtime.consoleRestore?.()
    for (const cleanup of this.runtime.cleanup) cleanup()
    await this.runtime.client.dispose()
  }

  private emit(level: LogLevel, values: readonly unknown[], mirrorConsole = true): void {
    if (levelValue(level) < levelValue(this.runtime.minLevel)) return
    const entry: LogEntry = {
      content: serializeLogArguments(values),
      level,
      scope: this.scope,
      timestamp: new Date().toISOString(),
    }
    if (mirrorConsole) {
      const writer = this.runtime.consoleWriters[LEVEL_CONSOLE[level]]
      writer(formatLogEntry(entry))
    }
    this.runtime.client.write([entry])
  }

  private captureConsole(): Record<ConsoleMethod, ConsoleWriter> {
    const noop = () => undefined
    if (typeof console === 'undefined')
      return { debug: noop, error: noop, info: noop, log: noop, trace: noop, warn: noop }
    return {
      debug: console.debug.bind(console),
      error: console.error.bind(console),
      info: console.info.bind(console),
      log: console.log.bind(console),
      trace: console.trace.bind(console),
      warn: console.warn.bind(console),
    }
  }
}

export const createLogger = (scope = 'app', options: LoggerOptions = {}) =>
  new Logger(scope, options)

/** Shared queue used by application modules and third-party plugins. */
export const logger = createLogger('delta-comic', { captureErrors: false, flushOnLifecycle: false })

/** Typed native reader/export client sharing the global logger transport. */
export const loggerClient = logger.client

export const listLogFiles = (): Promise<LogFileInfo[]> => loggerClient.listLogFiles()

export const readLogFile = (path: string): Promise<LogFileContent> => loggerClient.readLogFile(path)

export const exportLogs = (options?: ExportLogsOptions): Promise<string> =>
  loggerClient.exportLogs(options)

const globalInstallations = new WeakMap<Logger, () => void>()

/** Installs console/error/lifecycle capture once for the shared app logger. */
export const installGlobalLogger = (target: Logger = logger): (() => void) => {
  const existing = globalInstallations.get(target)
  if (existing) return existing
  const cleanups = [target.proxyConsole(), target.captureGlobalErrors(), target.flushOnLifecycle()]
  const uninstall = () => {
    for (const cleanup of [...cleanups].reverse()) cleanup()
    globalInstallations.delete(target)
  }
  globalInstallations.set(target, uninstall)
  return uninstall
}