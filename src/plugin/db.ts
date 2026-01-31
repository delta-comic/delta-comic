import { db } from '@/db'
import type { PluginMeta } from 'delta-comic-core'
import type {
  JSONColumnType,
  Selectable,
} from 'kysely'


export namespace PluginArchiveDB {
  export interface Table {
    installerName: string
    loaderName: string
    pluginName: string
    meta: JSONColumnType<PluginMeta>
    enable: boolean
    installInput: string
    displayName: string
  }
  export type Meta = Selectable<Table>

  export function getByEnabled(isEnabled: boolean) {
    return db.value
      .selectFrom('plugin')
      .where('enable', '=', isEnabled)
      .selectAll()
      .execute()
  }

  export function get(pluginName: string) {
    return db.value
      .selectFrom('plugin')
      .where('pluginName', '=', pluginName)
      .selectAll()
      .executeTakeFirstOrThrow()
  }

  export async function toggleEnable(pluginName: string) {
    const isEnable = await db.value
      .selectFrom('plugin')
      .where('pluginName', '=', pluginName)
      .select('enable')
      .executeTakeFirstOrThrow()
    return db.value
      .updateTable('plugin')
      .where('pluginName', '=', pluginName)
      .set({ enable: !isEnable.enable })
      .execute()
  }
}