import type { Insertable, Selectable, Updateable } from 'kysely'

export interface ServerPluginScriptsTable {
  plugin_id: string
  source: string
  enabled: number
  interval_hours: number
  next_run_at: number
  created_at: number
  updated_at: number
}

export type ServerPluginScript = Selectable<ServerPluginScriptsTable>
export type NewServerPluginScript = Insertable<ServerPluginScriptsTable>
export type ServerPluginScriptUpdate = Updateable<ServerPluginScriptsTable>
