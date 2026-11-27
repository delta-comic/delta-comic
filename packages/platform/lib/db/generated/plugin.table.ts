import type { Insertable, Selectable, Updateable, JSONColumnType } from 'kysely'

import type { PluginManifest, PluginUserConfig } from '../../manifest'

export interface PluginTable {
  installerName: string
  loaderName: string
  revision: string | null
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