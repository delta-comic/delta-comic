import {
  authSessionsRowSchema,
  authTerminalsRowSchema,
  authUsersRowSchema,
} from '@/infrastructure/d1/generated/schemas'
import { createKysely } from '@/infrastructure/d1/kysely'
import {
  assertDatabasePatch,
  assertDatabaseRead,
  assertDatabaseWrite,
} from '@/infrastructure/d1/validation'

import type { AuthSessionRow, AuthTerminalRow, AuthUserRow } from './auth.types'

export class AuthRepository {
  private readonly kysely

  constructor(private readonly db: D1Database) {
    this.kysely = createKysely(db)
  }

  async findUserByLoginName(loginName: string): Promise<AuthUserRow | null> {
    return await this.kysely
      .selectFrom('auth_users')
      .selectAll()
      .where('login_name', '=', loginName)
      .executeTakeFirst()
      .then(row => (row ? assertDatabaseRead(authUsersRowSchema, 'auth_users', row) : null))
  }

  async findUserById(id: string): Promise<AuthUserRow | null> {
    return await this.kysely
      .selectFrom('auth_users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
      .then(row => (row ? assertDatabaseRead(authUsersRowSchema, 'auth_users', row) : null))
  }

  async createUser(row: AuthUserRow): Promise<void> {
    await this.kysely
      .insertInto('auth_users')
      .values(assertDatabaseWrite(authUsersRowSchema, 'auth_users', row))
      .execute()
  }

  async upsertTerminal(row: AuthTerminalRow): Promise<void> {
    assertDatabaseWrite(authTerminalsRowSchema, 'auth_terminals', row)
    await this.kysely
      .insertInto('auth_terminals')
      .values(row)
      .onConflict(oc =>
        oc
          .columns(['user_id', 'terminal_uuid'])
          .doUpdateSet({
            app_version: row.app_version,
            display_name: row.display_name,
            last_seen_at: row.last_seen_at,
            platform: row.platform,
            revoked_at: null,
          }),
      )
      .execute()
  }

  async findTerminal(userId: string, terminalUuid: string): Promise<AuthTerminalRow | null> {
    return await this.kysely
      .selectFrom('auth_terminals')
      .selectAll()
      .where('user_id', '=', userId)
      .where('terminal_uuid', '=', terminalUuid)
      .executeTakeFirst()
      .then(row => (row ? assertDatabaseRead(authTerminalsRowSchema, 'auth_terminals', row) : null))
  }

  async createSession(row: AuthSessionRow): Promise<void> {
    await this.kysely
      .insertInto('auth_sessions')
      .values(assertDatabaseWrite(authSessionsRowSchema, 'auth_sessions', row))
      .execute()
  }

  async findSessionByAccessTokenHash(accessTokenHash: string): Promise<AuthSessionRow | null> {
    return await this.kysely
      .selectFrom('auth_sessions')
      .selectAll()
      .where('access_token_hash', '=', accessTokenHash)
      .executeTakeFirst()
      .then(row => (row ? assertDatabaseRead(authSessionsRowSchema, 'auth_sessions', row) : null))
  }

  async findSessionByRefreshTokenHash(refreshTokenHash: string): Promise<AuthSessionRow | null> {
    return await this.kysely
      .selectFrom('auth_sessions')
      .selectAll()
      .where('refresh_token_hash', '=', refreshTokenHash)
      .executeTakeFirst()
      .then(row => (row ? assertDatabaseRead(authSessionsRowSchema, 'auth_sessions', row) : null))
  }

  async revokeSession(sessionId: string, revokedAt: number): Promise<void> {
    assertDatabasePatch(authSessionsRowSchema, 'auth_sessions', { revoked_at: revokedAt })
    await this.kysely
      .updateTable('auth_sessions')
      .set({ revoked_at: revokedAt })
      .where('id', '=', sessionId)
      .where('revoked_at', 'is', null)
      .execute()
  }

  async rotateSession(
    oldSessionId: string,
    oldRotatedAt: number,
    newSession: AuthSessionRow,
  ): Promise<void> {
    assertDatabasePatch(authSessionsRowSchema, 'auth_sessions', {
      rotated_at: oldRotatedAt,
      revoked_at: oldRotatedAt,
    })
    assertDatabaseWrite(authSessionsRowSchema, 'auth_sessions', newSession)
    await this.db.batch([
      this.db
        .prepare(
          'UPDATE auth_sessions SET rotated_at = ?, revoked_at = ? WHERE id = ? AND revoked_at IS NULL',
        )
        .bind(oldRotatedAt, oldRotatedAt, oldSessionId),
      this.db
        .prepare(
          `INSERT INTO auth_sessions
           (id, user_id, terminal_uuid, access_token_hash, refresh_token_hash, created_at,
            access_expires_at, refresh_expires_at, rotated_at, revoked_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newSession.id,
          newSession.user_id,
          newSession.terminal_uuid,
          newSession.access_token_hash,
          newSession.refresh_token_hash,
          newSession.created_at,
          newSession.access_expires_at,
          newSession.refresh_expires_at,
          newSession.rotated_at,
          newSession.revoked_at,
        ),
    ])
  }
}