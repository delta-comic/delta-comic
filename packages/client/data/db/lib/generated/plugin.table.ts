import type { PluginManifest } from '@delta-comic/model'
import type { Insertable, Selectable, Updateable, JSONColumnType } from 'kysely'

export interface PluginTable {
  installerName: string
  loaderName: string
  pluginName: string
  meta: JSONColumnType<PluginManifest>
  enable: boolean
  installInput: string
  displayName: string | null
}

export type Plugin = Selectable<PluginTable>
export type NewPlugin = Insertable<PluginTable>
export type PluginUpdate = Updateable<PluginTable>