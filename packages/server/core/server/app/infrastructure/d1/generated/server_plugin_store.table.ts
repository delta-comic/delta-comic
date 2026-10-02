import type { Insertable, Selectable, Updateable } from 'kysely'

export interface ServerPluginStoreTable {
  tenant_id: string
  plugin_id: string
  key: string
  value_json: string
}

export type ServerPluginStore = Selectable<ServerPluginStoreTable>
export type NewServerPluginStore = Insertable<ServerPluginStoreTable>
export type ServerPluginStoreUpdate = Updateable<ServerPluginStoreTable>