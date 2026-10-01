export interface DiagnosticRecord {
  id: string
  timestamp: number
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  source: string
  message: string
  details?: Record<string, unknown>
  pluginId?: string
  installationId?: string
  fiberId?: string
  eventId?: string
}

export interface DiagnosticPluginSnapshot {
  id: string
  version: string
  state: 'pending' | 'loading' | 'active' | 'failed' | 'disposed'
  dependencies: readonly string[]
  fiberId?: string
  provides?: readonly string[]
  config?: unknown
  error?: string
}

export interface DiagnosticServiceSnapshot {
  id: string
  pluginId?: string
  state?: 'registered' | 'active' | 'failed' | 'disposed'
}

export interface DiagnosticEventSnapshot {
  id: string
  event: string
  pluginId?: string
  listenerCount?: number
  callCount?: number
}

export interface DiagnosticFiberSnapshot {
  id: string
  pluginId?: string
  state: DiagnosticPluginSnapshot['state']
  disposed: boolean
}

export interface DiagnosticDependencyGraph {
  readonly nodes: readonly string[]
  readonly edges: readonly { from: string; to: string }[]
}

export interface DiagnosticConfigSource {
  readonly id: string
  readonly source: string
  readonly keys: readonly string[]
}

export interface DiagnosticSnapshot {
  capturedAt: number
  runtime: string
  plugins: readonly DiagnosticPluginSnapshot[]
  records: readonly DiagnosticRecord[]
  services: readonly DiagnosticServiceSnapshot[]
  events: readonly DiagnosticEventSnapshot[]
  fibers: readonly DiagnosticFiberSnapshot[]
  dependencyGraph: DiagnosticDependencyGraph
  configSources: readonly DiagnosticConfigSource[]
  metrics?: SystemMetrics
}

export interface SystemMetrics {
  memoryUsage: number
  activePluginsCount: number
  timestamp: number
}

export interface DiagnosticRecorderOptions {
  source: string
  capacity?: number
  now?: () => number
  id?: () => string
  pluginId?: string
  installationId?: string
  redact?: (details: Record<string, unknown>) => Record<string, unknown>
  onRecord?: (record: DiagnosticRecord) => void | Promise<void>
}

export interface DiagnosticReplayEvent {
  readonly id?: string
  readonly level: DiagnosticRecord['level']
  readonly message: string
  readonly details?: Record<string, unknown>
  readonly timestampOffset: number
  readonly pluginId?: string
  readonly eventId?: string
}

export interface RecordedEvent {
  readonly id: string
  readonly timestamp: number
  readonly event: string
  readonly payload?: unknown
  readonly result?: unknown
  readonly error?: string
  readonly pluginId?: string
  readonly duration: number
}

export interface DiagnosticLogger {
  trace(message: string, details?: Record<string, unknown>): DiagnosticRecord
  debug(message: string, details?: Record<string, unknown>): DiagnosticRecord
  info(message: string, details?: Record<string, unknown>): DiagnosticRecord
  warn(message: string, details?: Record<string, unknown>): DiagnosticRecord
  error(message: string, details?: Record<string, unknown>): DiagnosticRecord
  fatal(message: string, details?: Record<string, unknown>): DiagnosticRecord
}

export interface DiagnosticHarnessArchive {
  readonly version: 1
  readonly snapshot: DiagnosticSnapshot
  readonly replay: readonly DiagnosticReplayEvent[]
}

export type DiagnosticOperation<T> = () => T | PromiseLike<T>

const isPromiseLike = <T>(value: T | PromiseLike<T>): value is PromiseLike<T> =>
  typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function'

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error))

const sensitiveKey = /(?:password|passwd|secret|token|authorization|cookie|payload|body|content)/i

const redactDetails = (details: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(details)) {
    result[key] = sensitiveKey.test(key) ? '[redacted]' : value
  }
  return result
}

export function withDiagnostic<T>(
  diagnostics: DiagnosticRecorder,
  event: string,
  operation: () => Promise<T>,
  details?: Record<string, unknown>,
): Promise<T>
export function withDiagnostic<T>(
  diagnostics: DiagnosticRecorder,
  event: string,
  operation: () => T,
  details?: Record<string, unknown>,
): T
export function withDiagnostic<T>(
  diagnostics: DiagnosticRecorder,
  event: string,
  operation: DiagnosticOperation<T>,
  details?: Record<string, unknown>,
): T | PromiseLike<T> {
  const startedAt = Date.now()
  const complete = (result: T) => {
    diagnostics.record('debug', `${event} completed`, {
      ...details,
      durationMs: Date.now() - startedAt,
    })
    return result
  }
  const fail = (error: unknown): never => {
    diagnostics.record('error', `${event} failed`, {
      ...details,
      durationMs: Date.now() - startedAt,
      error: describeError(error),
    })
    throw error
  }

  try {
    const result = operation()
    return isPromiseLike(result) ? result.then(complete, fail) : complete(result)
  } catch (error) {
    return fail(error)
  }
}

export interface DiagnosticTarget {
  readonly diagnostics: DiagnosticRecorder
}

export const diagnostic = (event?: string) => {
  return function <This extends DiagnosticTarget, Args extends unknown[], Result>(
    method: (this: This, ...args: Args) => Result,
    context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Result>,
  ) {
    const name = event ?? String(context.name)
    return function (this: This, ...args: Args): Result {
      return withDiagnostic(this.diagnostics, name, () => method.call(this, ...args))
    }
  }
}

export class DiagnosticRecorder {
  readonly #records: DiagnosticRecord[] = []
  readonly #capacity: number
  readonly #now: () => number
  readonly #id: () => string
  readonly #source: string
  readonly #pluginId: string | undefined
  readonly #installationId: string | undefined
  readonly #redact: (details: Record<string, unknown>) => Record<string, unknown>
  readonly #onRecord: ((record: DiagnosticRecord) => void | Promise<void>) | undefined

  public constructor(options: DiagnosticRecorderOptions) {
    this.#capacity = Math.max(1, options.capacity ?? 200)
    this.#now = options.now ?? Date.now
    this.#id =
      options.id ??
      (() => globalThis.crypto?.randomUUID() ?? `${this.#now()}-${this.#records.length}`)
    this.#source = options.source
    this.#pluginId = options.pluginId
    this.#installationId = options.installationId
    this.#redact = options.redact ?? redactDetails
    this.#onRecord = options.onRecord
  }

  public record(
    level: DiagnosticRecord['level'],
    message: string,
    details?: Record<string, unknown>,
  ): DiagnosticRecord {
    const record: DiagnosticRecord = {
      id: this.#id(),
      timestamp: this.#now(),
      level,
      source: this.#source,
      message,
      ...(details === undefined ? {} : { details: this.#redact(details) }),
      ...(this.#pluginId === undefined ? {} : { pluginId: this.#pluginId }),
      ...(this.#installationId === undefined ? {} : { installationId: this.#installationId }),
    }
    this.#records.push(record)
    if (this.#records.length > this.#capacity)
      this.#records.splice(0, this.#records.length - this.#capacity)
    if (this.#onRecord) {
      try {
        const result = this.#onRecord(record)
        if (isPromiseLike(result)) void result.catch(() => undefined)
      } catch {
        // A persistence sink must not break the diagnostic caller.
      }
    }
    return record
  }

  public list(): readonly DiagnosticRecord[] {
    return this.#records.slice()
  }

  public snapshot(
    plugins: readonly DiagnosticPluginSnapshot[] = [],
    metrics?: SystemMetrics,
    options: {
      services?: readonly DiagnosticServiceSnapshot[]
      events?: readonly DiagnosticEventSnapshot[]
      fibers?: readonly DiagnosticFiberSnapshot[]
      dependencyGraph?: DiagnosticDependencyGraph
      configSources?: readonly DiagnosticConfigSource[]
    } = {},
  ): DiagnosticSnapshot {
    return {
      capturedAt: this.#now(),
      runtime: this.#source,
      plugins: plugins.slice(),
      records: this.list(),
      services: options.services?.slice() ?? [],
      events: options.events?.slice() ?? [],
      fibers: options.fibers?.slice() ?? [],
      dependencyGraph: options.dependencyGraph ?? { nodes: [], edges: [] },
      configSources: options.configSources?.slice() ?? [],
      ...(metrics === undefined ? {} : { metrics }),
    }
  }

  public logger(context: Record<string, unknown> = {}): DiagnosticLogger {
    const write = (
      level: DiagnosticRecord['level'],
      message: string,
      details?: Record<string, unknown>,
    ) => this.record(level, message, { ...context, ...details })
    return {
      trace: (message, details) => write('trace', message, details),
      debug: (message, details) => write('debug', message, details),
      info: (message, details) => write('info', message, details),
      warn: (message, details) => write('warn', message, details),
      error: (message, details) => write('error', message, details),
      fatal: (message, details) => write('fatal', message, details),
    }
  }
}

export const createDiagnosticLogger = (
  recorder: DiagnosticRecorder,
  context?: Record<string, unknown>,
): DiagnosticLogger => recorder.logger(context)

export class EventRecorder {
  readonly #events: RecordedEvent[] = []
  readonly #now: () => number
  readonly #id: () => string
  #recording = false

  public constructor(options: { now?: () => number; id?: () => string } = {}) {
    this.#now = options.now ?? Date.now
    this.#id =
      options.id ??
      (() => globalThis.crypto?.randomUUID() ?? `${this.#now()}-${this.#events.length}`)
  }

  public get recording(): boolean {
    return this.#recording
  }

  public start(): void {
    this.#recording = true
  }

  public stop(): readonly RecordedEvent[] {
    this.#recording = false
    return this.list()
  }

  public clear(): void {
    this.#events.length = 0
  }

  public list(): readonly RecordedEvent[] {
    return this.#events.slice()
  }

  public record(
    event: string,
    options: {
      payload?: unknown
      result?: unknown
      error?: unknown
      pluginId?: string
      startedAt?: number
      duration?: number
      includePayload?: boolean
    } = {},
  ): RecordedEvent | undefined {
    if (!this.#recording) return undefined
    const timestamp = this.#now()
    const record: RecordedEvent = {
      id: this.#id(),
      timestamp,
      event,
      ...(options.includePayload === true && options.payload !== undefined
        ? { payload: options.payload }
        : {}),
      ...(options.result === undefined ? {} : { result: options.result }),
      ...(options.error === undefined ? {} : { error: describeError(options.error) }),
      ...(options.pluginId === undefined ? {} : { pluginId: options.pluginId }),
      duration:
        options.duration ?? (options.startedAt === undefined ? 0 : timestamp - options.startedAt),
    }
    this.#events.push(record)
    return record
  }

  public async replay(
    events: readonly RecordedEvent[] = this.list(),
    dispatch: (event: RecordedEvent, index: number) => void | Promise<void>,
  ): Promise<void> {
    for (const [index, event] of events.entries()) await dispatch(event, index)
  }

  public async call<T>(
    event: string,
    operation: () => T | Promise<T>,
    options: { payload?: unknown; pluginId?: string; includePayload?: boolean } = {},
  ): Promise<T> {
    const startedAt = this.#now()
    try {
      const result = await operation()
      this.record(event, { ...options, result, startedAt })
      return result
    } catch (error) {
      this.record(event, { ...options, error, startedAt })
      throw error
    }
  }
}

export class DiagnosticHarness {
  public constructor(private readonly recorder: DiagnosticRecorder) {}

  public capture(
    plugins: readonly DiagnosticPluginSnapshot[] = [],
    metrics?: SystemMetrics,
  ): DiagnosticHarnessArchive {
    const snapshot = this.recorder.snapshot(plugins, metrics)
    const firstTimestamp = snapshot.records[0]?.timestamp ?? snapshot.capturedAt
    return {
      version: 1,
      snapshot,
      replay: snapshot.records.map(record => ({
        id: record.id,
        level: record.level,
        message: record.message,
        ...(record.details === undefined ? {} : { details: record.details }),
        timestampOffset: record.timestamp - firstTimestamp,
        ...(record.pluginId === undefined ? {} : { pluginId: record.pluginId }),
        ...(record.eventId === undefined ? {} : { eventId: record.eventId }),
      })),
    }
  }

  public export(archive: DiagnosticHarnessArchive): string {
    return JSON.stringify(archive)
  }

  public import(serialized: string): DiagnosticHarnessArchive {
    const value: unknown = JSON.parse(serialized)
    if (!isDiagnosticHarnessArchive(value)) throw new TypeError('Invalid diagnostic archive')
    return value
  }

  public async replay(
    archive: DiagnosticHarnessArchive,
    dispatch: (event: DiagnosticReplayEvent, index: number) => void | Promise<void>,
  ): Promise<void> {
    if (!isDiagnosticHarnessArchive(archive)) throw new TypeError('Invalid diagnostic archive')
    for (const [index, event] of archive.replay.entries()) await dispatch(event, index)
  }
}

export type DiagnosticReplayHandler = (
  event: DiagnosticReplayEvent,
  index: number,
) => void | Promise<void>

/** Dispatches archived diagnostic events to registered handlers in archive order. */
export class DiagnosticReplayExecutor {
  readonly #handlers = new Map<string, Set<DiagnosticReplayHandler>>()

  public constructor(private readonly harness: DiagnosticHarness) {}

  public register(message: string, handler: DiagnosticReplayHandler): () => void {
    const handlers = this.#handlers.get(message) ?? new Set<DiagnosticReplayHandler>()
    handlers.add(handler)
    this.#handlers.set(message, handlers)
    return () => {
      handlers.delete(handler)
      if (handlers.size === 0) this.#handlers.delete(message)
    }
  }

  public async replay(archive: DiagnosticHarnessArchive): Promise<void> {
    await this.harness.replay(archive, async (event, index) => {
      const handlers = this.#handlers.get(event.message)
      if (!handlers) return
      for (const handler of handlers) await handler(event, index)
    })
  }
}

const isDiagnosticHarnessArchive = (value: unknown): value is DiagnosticHarnessArchive => {
  if (typeof value !== 'object' || value === null) return false
  const archive = value as Partial<DiagnosticHarnessArchive>
  return (
    archive.version === 1 &&
    typeof archive.snapshot === 'object' &&
    archive.snapshot !== null &&
    Array.isArray(archive.snapshot.records) &&
    Array.isArray(archive.replay) &&
    archive.replay.every(
      event =>
        typeof event === 'object' &&
        event !== null &&
        typeof event.message === 'string' &&
        typeof event.timestampOffset === 'number' &&
        (event.id === undefined || typeof event.id === 'string'),
    )
  )
}