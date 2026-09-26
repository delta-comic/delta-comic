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