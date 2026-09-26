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