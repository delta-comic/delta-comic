export interface DiagnosticRecord {
  id: string
  timestamp: number
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  source: string
  message: string
  details?: Record<string, unknown>
}

export interface DiagnosticPluginSnapshot {
  id: string
  version: string
  state: 'pending' | 'loading' | 'active' | 'failed' | 'disposed'
  dependencies: readonly string[]
  error?: string
}

export interface DiagnosticSnapshot {
  capturedAt: number
  runtime: string
  plugins: readonly DiagnosticPluginSnapshot[]
  records: readonly DiagnosticRecord[]
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
}

export interface DiagnosticReplayEvent {
  readonly level: DiagnosticRecord['level']
  readonly message: string
  readonly details?: Record<string, unknown>
  readonly timestampOffset: number
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

  public constructor(options: DiagnosticRecorderOptions) {
    this.#capacity = Math.max(1, options.capacity ?? 200)
    this.#now = options.now ?? Date.now
    this.#id =
      options.id ??
      (() => globalThis.crypto?.randomUUID() ?? `${this.#now()}-${this.#records.length}`)
    this.#source = options.source
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
      ...(details === undefined ? {} : { details }),
    }
    this.#records.push(record)
    if (this.#records.length > this.#capacity)
      this.#records.splice(0, this.#records.length - this.#capacity)
    return record
  }

  public list(): readonly DiagnosticRecord[] {
    return this.#records.slice()
  }

  public snapshot(
    plugins: readonly DiagnosticPluginSnapshot[] = [],
    metrics?: SystemMetrics,
  ): DiagnosticSnapshot {
    return {
      capturedAt: this.#now(),
      runtime: this.#source,
      plugins: plugins.slice(),
      records: this.list(),
      ...(metrics === undefined ? {} : { metrics }),
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
        level: record.level,
        message: record.message,
        ...(record.details === undefined ? {} : { details: record.details }),
        timestampOffset: record.timestamp - firstTimestamp,
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
        typeof event.timestampOffset === 'number',
    )
  )
}