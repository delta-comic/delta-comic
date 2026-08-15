import type { Insertable, Selectable, Updateable, Generated } from 'kysely'

export interface SyncChangesTable {
  server_seq: Generated<number>
  user_id: string
  collection: 'itemStore' | 'favouriteCard' | 'favouriteItem' | 'history' | 'recentView' | 'subscribe' | 'config'
  entity_id: string
  action: 'upsert' | 'delete'
  data_json: string | null
  data_hash: string
  version: string
  client_changed_at: number
  server_changed_at: number
  deleted_at: number | null
  origin_terminal_uuid: string
  origin_op_id: string
}

export type SyncChange = Selectable<SyncChangesTable>
export type NewSyncChange = Insertable<SyncChangesTable>
export type SyncChangeUpdate = Updateable<SyncChangesTable>