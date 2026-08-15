import type { Insertable, Selectable, Updateable, JSONColumnType } from 'kysely'
import type { PluginManifest } from '@delta-comic/model'

export interface PluginTable {
  installerName: string
  loaderName: string
  pluginName: string
  meta: JSONColumnType<PluginManifest>
  enable: number
  installInput: string
  displayName: string | null
}

export type Plugin = Selectable<PluginTable>
export type NewPlugin = Insertable<PluginTable>
export type PluginUpdate = Updateable<PluginTable>