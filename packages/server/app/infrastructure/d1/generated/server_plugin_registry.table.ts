import type { Insertable, Selectable, Updateable } from 'kysely'

export interface ServerPluginRegistryTable {
  plugin_id: string
  manifest_json: string
  source: string
  trusted: number
  registered_at: number
  updated_at: number
}

export type ServerPluginRegistry = Selectable<ServerPluginRegistryTable>
export type NewServerPluginRegistry = Insertable<ServerPluginRegistryTable>
export type ServerPluginRegistryUpdate = Updateable<ServerPluginRegistryTable>
