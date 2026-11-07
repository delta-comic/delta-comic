export interface DiagnosticRecord {
  id: string
  timestamp: number
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  source: string
  message: string
  details?: Record<string, unknown>
  pluginId?: string
}

export interface DiagnosticSnapshot {
  capturedAt: number
  runtime: string
  records: readonly DiagnosticRecord[]
}

export interface DiagnosticRecorderOptions {
  source: string
  capacity?: number
  pluginId?: string
  onRecord?: (record: DiagnosticRecord) => unknown
}

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error))

const sensitiveKey = /(?:password|passwd|secret|token|authorization|cookie|payload|body|content)/i

const redact = (details: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(details).map(([key, value]) => [
      key,
      sensitiveKey.test(key) ? '[redacted]' : value,
    ]),
  )

export class DiagnosticRecorder {
  readonly #records: DiagnosticRecord[] = []

  public constructor(private readonly options: DiagnosticRecorderOptions) {}

  public record(
    level: DiagnosticRecord['level'],
    message: string,
    details?: Record<string, unknown>,
  ): DiagnosticRecord {
    const record: DiagnosticRecord = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level,
      source: this.options.source,
      message,
      details: details && redact(details),
      pluginId: this.options.pluginId,
    }
    this.#records.push(record)
    const overflow = this.#records.length - (this.options.capacity ?? 200)
    if (overflow > 0) this.#records.splice(0, overflow)
    this.options.onRecord?.(record)
    return record
  }

  public list(): readonly DiagnosticRecord[] {
    return this.#records.slice()
  }

  public snapshot(): DiagnosticSnapshot {
    return { capturedAt: Date.now(), runtime: this.options.source, records: this.list() }
  }
}

export const withDiagnostic = async <T>(
  diagnostics: DiagnosticRecorder,
  event: string,
  operation: () => T | Promise<T>,
  details?: Record<string, unknown>,
): Promise<T> => {
  const startedAt = Date.now()
  try {
    const result = await operation()
    diagnostics.record('debug', `${event} completed`, {
      ...details,
      durationMs: Date.now() - startedAt,
    })
    return result
  } catch (error) {
    diagnostics.record('error', `${event} failed`, {
      ...details,
      durationMs: Date.now() - startedAt,
      error: describeError(error),
    })
    throw error
  }
}