import type { Insertable, Selectable, Updateable } from 'kysely'

export interface ServerPluginRunsTable {
  id: string
  tenant_id: string
  plugin_id: string
  flow_id: string
  trigger: 'manual' | 'scheduled'
  status: 'running' | 'succeeded' | 'failed'
  input_json: string | null
  result_json: string | null
  step_id: string | null
  error_message: string | null
  metrics_json: string
  started_at: number
  completed_at: number | null
}

export type ServerPluginRun = Selectable<ServerPluginRunsTable>
export type NewServerPluginRun = Insertable<ServerPluginRunsTable>
export type ServerPluginRunUpdate = Updateable<ServerPluginRunsTable>