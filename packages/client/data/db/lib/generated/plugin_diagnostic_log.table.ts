import type { Insertable, Selectable, Updateable } from 'kysely'

export interface PluginDiagnosticLogTable {
  id: string
  pluginId: string
  timestamp: number
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  source: string
  message: string
  details: string | null
  fiberId: string | null
  eventId: string | null
}

export type PluginDiagnosticLog = Selectable<PluginDiagnosticLogTable>
export type NewPluginDiagnosticLog = Insertable<PluginDiagnosticLogTable>
export type PluginDiagnosticLogUpdate = Updateable<PluginDiagnosticLogTable>