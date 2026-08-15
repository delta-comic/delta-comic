import type { Insertable, Selectable, Updateable } from 'kysely'

export interface AuthUsersTable {
  id: string
  login_name: string
  password_hash: string
  password_salt: string
  password_alg: string
  created_at: number
  updated_at: number
  disabled_at: number | null
}

export type AuthUser = Selectable<AuthUsersTable>
export type NewAuthUser = Insertable<AuthUsersTable>
export type AuthUserUpdate = Updateable<AuthUsersTable>