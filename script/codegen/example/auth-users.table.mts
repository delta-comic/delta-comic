import { Type } from '@sinclair/typebox'

import { defineTable, type TableRow } from '../schema.mts'

export const authUsersTable = defineTable(
  'auth_users',
  {
    id: Type.String({ format: 'uuid' }),
    login_name: Type.String({ minLength: 3, maxLength: 64 }),
    password_hash: Type.String(),
    password_salt: Type.String(),
    password_alg: Type.String(),
    created_at: Type.Integer(),
    updated_at: Type.Integer(),
    disabled_at: Type.Optional(Type.Integer()),
  },
  {
    primaryKey: ['id'],
    unique: [['login_name']],
    indexes: [{ name: 'idx_auth_users_login_name', columns: ['login_name'] }],
  },
)

export type AuthUser = TableRow<typeof authUsersTable>