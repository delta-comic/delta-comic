import {
  createDiagnosticLogger,
  type DiagnosticLogger,
  type DiagnosticRecorder,
} from '@delta-comic/both'

export interface ServerDiagnosticLogger extends DiagnosticLogger {
  readonly pluginId: string
  readonly installationId: string
}

export const createServerDiagnosticLogger = (
  pluginId: string,
  installationId: string,
  diagnostics: DiagnosticRecorder,
): ServerDiagnosticLogger => ({
  pluginId,
  installationId,
  ...createDiagnosticLogger(diagnostics, { pluginId, installationId }),
})