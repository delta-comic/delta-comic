import type { Insertable, Selectable, Updateable } from 'kysely'

export interface ServerPluginPackagesTable {
  tenant_id: string
  plugin_id: string
  manifest_json: string
  document_json: string
  config_json: string
  enabled: number
  created_at: number
  updated_at: number
}

export type ServerPluginPackage = Selectable<ServerPluginPackagesTable>
export type NewServerPluginPackage = Insertable<ServerPluginPackagesTable>
export type ServerPluginPackageUpdate = Updateable<ServerPluginPackagesTable>