import type { PluginMeta } from '@delta-comic/plugin'
import type { JSONColumnType, Selectable } from 'kysely'

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

export async function getByEnabled(isEnabled: boolean) {
  const { db } = await import('.')
  return db.value.selectFrom('plugin').where('enable', '=', isEnabled).selectAll().execute()
}

export async function get(pluginName: string) {
  const { db } = await import('.')
  return db.value
    .selectFrom('plugin')
    .where('pluginName', '=', pluginName)
    .selectAll()
    .executeTakeFirstOrThrow()
}

export async function toggleEnable(pluginName: string) {
  const { db } = await import('.')
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