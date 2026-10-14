import type { Insertable, Selectable, Updateable } from 'kysely'

export interface ServerPluginSchedulesTable {
  tenant_id: string
  plugin_id: string
  flow_id: string
  enabled: number
  interval_hours: number
  next_run_at: number
  updated_at: number
}

export type ServerPluginSchedule = Selectable<ServerPluginSchedulesTable>
export type NewServerPluginSchedule = Insertable<ServerPluginSchedulesTable>
export type ServerPluginScheduleUpdate = Updateable<ServerPluginSchedulesTable>