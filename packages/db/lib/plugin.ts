import type { JSONColumnType, Selectable } from 'kysely'

export interface Meta {
  name: { display: string; id: string }
  version: { plugin: string; supportCore: string }
  author: string
  description: string
  require: { id: string; download?: string | undefined }[]
  entry?: { jsPath: string; cssPath?: string }
  beforeBoot?: { path: string; slot: string }[]
}

export interface Table {
  installerName: string
  loaderName: string
  pluginName: string
  meta: JSONColumnType<Meta>
  enable: boolean
  installInput: string
  displayName: string
}
export type Archive = Selectable<Table>

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