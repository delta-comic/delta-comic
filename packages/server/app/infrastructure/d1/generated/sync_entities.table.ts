import type { Insertable, Selectable, Updateable } from 'kysely'

export interface SyncEntitiesTable {
  user_id: string
  collection:
    | 'itemStore'
    | 'favouriteCard'
    | 'favouriteItem'
    | 'history'
    | 'recentView'
    | 'subscribe'
    | 'config'
  entity_id: string
  data_json: string | null
  data_hash: string
  version: string
  client_changed_at: number
  server_updated_at: number
  deleted_at: number | null
  last_terminal_uuid: string
  last_op_id: string
}

export type SyncEntity = Selectable<SyncEntitiesTable>
export type NewSyncEntity = Insertable<SyncEntitiesTable>
export type SyncEntityUpdate = Updateable<SyncEntitiesTable>