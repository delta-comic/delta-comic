import type { Insertable, Selectable, Updateable } from 'kysely'

export interface AuthTerminalsTable {
  user_id: string
  terminal_uuid: string
  display_name: string | null
  platform: string | null
  app_version: string | null
  created_at: number
  last_seen_at: number
  revoked_at: number | null
}

export type AuthTerminal = Selectable<AuthTerminalsTable>
export type NewAuthTerminal = Insertable<AuthTerminalsTable>
export type AuthTerminalUpdate = Updateable<AuthTerminalsTable>
