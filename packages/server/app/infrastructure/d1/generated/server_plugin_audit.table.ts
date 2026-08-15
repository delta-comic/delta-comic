import type { Insertable, Selectable, Updateable } from 'kysely'

export interface ServerPluginAuditTable {
  id: string
  plugin_id: string
  job_id: string
  action: 'configure' | 'disable' | 'enable' | 'health' | 'install' | 'register' | 'uninstall' | 'update'
  outcome: 'failed' | 'succeeded'
  actor_id: string
  detail_json: string | null
  created_at: number
}

export type ServerPluginAudit = Selectable<ServerPluginAuditTable>
export type NewServerPluginAudit = Insertable<ServerPluginAuditTable>
export type ServerPluginAuditUpdate = Updateable<ServerPluginAuditTable>