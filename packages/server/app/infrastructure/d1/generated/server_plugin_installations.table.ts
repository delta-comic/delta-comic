import type { Insertable, Selectable, Updateable } from 'kysely'

export interface ServerPluginInstallationsTable {
  plugin_id: string
  installed_version: string
  desired_state: 'disabled' | 'enabled'
  observed_state: 'disabled' | 'enabled' | 'failed' | 'installed'
  config_json: string
  installed_at: number
  updated_at: number
  last_error: string | null
  last_health_json: string | null
  last_health_at: number | null
}

export type ServerPluginInstallation = Selectable<ServerPluginInstallationsTable>
export type NewServerPluginInstallation = Insertable<ServerPluginInstallationsTable>
export type ServerPluginInstallationUpdate = Updateable<ServerPluginInstallationsTable>