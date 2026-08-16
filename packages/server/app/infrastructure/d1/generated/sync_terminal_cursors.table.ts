import type { Insertable, Selectable, Updateable } from 'kysely'

export interface SyncTerminalCursorsTable {
  user_id: string
  terminal_uuid: string
  last_pulled_seq: number
  last_pushed_at: number | null
  last_seen_at: number
}

export type SyncTerminalCursor = Selectable<SyncTerminalCursorsTable>
export type NewSyncTerminalCursor = Insertable<SyncTerminalCursorsTable>
export type SyncTerminalCursorUpdate = Updateable<SyncTerminalCursorsTable>