import type { PluginManifest, PluginUserConfig } from '@delta-comic/shared-plugin-manifest'
import type { Insertable, Selectable, Updateable, JSONColumnType } from 'kysely'

export interface PluginTable {
  installerName: string
  loaderName: string
  pluginName: string
  meta: JSONColumnType<PluginManifest>
  config: JSONColumnType<PluginUserConfig> | null
  enable: boolean
  installInput: string
  displayName: string | null
}

export type Plugin = Selectable<PluginTable>
export type NewPlugin = Insertable<PluginTable>
export type PluginUpdate = Updateable<PluginTable>