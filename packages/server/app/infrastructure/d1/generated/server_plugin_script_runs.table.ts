import type { Insertable, Selectable, Updateable } from 'kysely'

export interface ServerPluginScriptRunsTable {
  id: string
  plugin_id: string
  trigger: 'manual' | 'scheduled'
  status: 'failed' | 'succeeded'
  input_json: string | null
  result_json: string | null
  error_message: string | null
  started_at: number
  completed_at: number
}

export type ServerPluginScriptRun = Selectable<ServerPluginScriptRunsTable>
export type NewServerPluginScriptRun = Insertable<ServerPluginScriptRunsTable>
export type ServerPluginScriptRunUpdate = Updateable<ServerPluginScriptRunsTable>