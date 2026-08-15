import type { Insertable, Selectable, Updateable } from 'kysely'

export interface AuthSessionsTable {
  id: string
  user_id: string
  terminal_uuid: string
  access_token_hash: string
  refresh_token_hash: string
  created_at: number
  access_expires_at: number
  refresh_expires_at: number
  rotated_at: number | null
  revoked_at: number | null
}

export type AuthSession = Selectable<AuthSessionsTable>
export type NewAuthSession = Insertable<AuthSessionsTable>
export type AuthSessionUpdate = Updateable<AuthSessionsTable>
