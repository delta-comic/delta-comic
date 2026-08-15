import type { Insertable, Selectable, Updateable } from 'kysely'

export interface SyncOpsTable {
  user_id: string
  terminal_uuid: string
  op_id: string
  collection: 'itemStore' | 'favouriteCard' | 'favouriteItem' | 'history' | 'recentView' | 'subscribe' | 'config'
  entity_id: string
  action: 'upsert' | 'delete'
  data_hash: string
  base_version: string | null
  result: 'applied' | 'replayed' | 'ignored_stale' | 'conflict' | 'failed'
  server_seq: number | null
  entity_version: string | null
  error_code: string | null
  error_message: string | null
  received_at: number
}

export type SyncOp = Selectable<SyncOpsTable>
export type NewSyncOp = Insertable<SyncOpsTable>
export type SyncOpUpdate = Updateable<SyncOpsTable>