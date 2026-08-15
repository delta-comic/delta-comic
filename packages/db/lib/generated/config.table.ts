import type { Insertable, Selectable, Updateable } from 'kysely'

export interface ConfigTable {
  belongTo: string
  form: string
  data: string
}

export type Config = Selectable<ConfigTable>
export type NewConfig = Insertable<ConfigTable>
export type ConfigUpdate = Updateable<ConfigTable>
