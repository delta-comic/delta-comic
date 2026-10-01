import {
  createDiagnosticLogger,
  type DiagnosticLogger,
  type DiagnosticRecorder,
  type RecordedEvent,
} from '@delta-comic/both'

export interface ClientDiagnosticLogger extends DiagnosticLogger {
  readonly pluginId: string
}

export const createClientDiagnosticLogger = (
  pluginId: string,
  diagnostics: DiagnosticRecorder,
): ClientDiagnosticLogger => ({ pluginId, ...createDiagnosticLogger(diagnostics, { pluginId }) })

export interface ClientEventRecorder {
  start(): void
  stop(): readonly RecordedEvent[]
}