import { describe, expect, it } from 'vitest'

import { AuthRepository } from '../../../../app/modules/auth/auth.repository'
import type {
  AuthSessionRow,
  AuthTerminalRow,
  AuthUserRow,
} from '../../../../app/modules/auth/auth.types'
import { D1Recorder } from '../../d1'

const user: AuthUserRow = {
  created_at: 10,
  disabled_at: null,
  id: 'usr_1',
  login_name: 'alice',
  password_alg: 'PBKDF2-SHA256',
  password_hash: 'hash',
  password_salt: 'salt',
  updated_at: 11,
}

const terminal: AuthTerminalRow = {
  app_version: '1.0.0',
  created_at: 12,
  display_name: 'phone',
  last_seen_at: 13,
  platform: 'android',
  revoked_at: null,
  terminal_uuid: 'terminal-1',
  user_id: user.id,
}

const session: AuthSessionRow = {
  access_expires_at: 100,
  access_token_hash: 'access-hash',
  created_at: 14,
  id: 'ses_1',
  refresh_expires_at: 200,
  refresh_token_hash: 'refresh-hash',
  revoked_at: null,
  rotated_at: null,
  terminal_uuid: terminal.terminal_uuid,
  user_id: user.id,
}

describe('AuthRepository', () => {
  it('binds user lookups and inserts in schema order', async () => {
    const recorder = new D1Recorder()
    recorder.firstResults.push(user, user)
    const repository = new AuthRepository(recorder.db)

    await expect(repository.findUserByLoginName('alice')).resolves.toEqual(user)
    await expect(repository.findUserById(user.id)).resolves.toEqual(user)
    await repository.createUser(user)

    expect(recorder.statements[0]).toMatchObject({ values: ['alice'] })
    expect(recorder.statements[0]?.sql).toContain('WHERE login_name = ?')
    expect(recorder.statements[1]).toMatchObject({ values: [user.id] })
    expect(recorder.statements[2]).toMatchObject({
      values: [
        user.id,
        user.login_name,
        user.password_hash,
        user.password_salt,
        user.password_alg,
        user.created_at,
        user.updated_at,
        user.disabled_at,
      ],
    })
  })

  it('inserts or updates and finds a terminal by its compound owner key', async () => {
    const recorder = new D1Recorder()
    recorder.firstResults.push(terminal)
    const repository = new AuthRepository(recorder.db)

    await repository.upsertTerminal(terminal)
    await expect(repository.findTerminal(user.id, terminal.terminal_uuid)).resolves.toEqual(
      terminal,
    )

    expect(recorder.statements[0]?.sql).toContain('ON CONFLICT(user_id, terminal_uuid)')
    expect(recorder.statements[0]?.values).toEqual([
      terminal.user_id,
      terminal.terminal_uuid,
      terminal.display_name,
      terminal.platform,
      terminal.app_version,
      terminal.created_at,
      terminal.last_seen_at,
      terminal.revoked_at,
    ])
    expect(recorder.statements[1]?.values).toEqual([user.id, terminal.terminal_uuid])
  })

  it('creates, resolves, and revokes sessions with the expected token keys', async () => {
    const recorder = new D1Recorder()
    recorder.firstResults.push(session, session)
    const repository = new AuthRepository(recorder.db)

    await repository.createSession(session)
    await expect(repository.findSessionByAccessTokenHash('access-hash')).resolves.toEqual(session)
    await expect(repository.findSessionByRefreshTokenHash('refresh-hash')).resolves.toEqual(session)
    await repository.revokeSession(session.id, 99)

    expect(recorder.statements[0]?.values).toEqual([
      session.id,
      session.user_id,
      session.terminal_uuid,
      session.access_token_hash,
      session.refresh_token_hash,
      session.created_at,
      session.access_expires_at,
      session.refresh_expires_at,
      session.rotated_at,
      session.revoked_at,
    ])
    expect(recorder.statements[1]).toMatchObject({ values: ['access-hash'] })
    expect(recorder.statements[2]).toMatchObject({ values: ['refresh-hash'] })
    expect(recorder.statements[3]).toMatchObject({ values: [99, session.id] })
  })

  it('rotates sessions atomically in a two-statement D1 batch', async () => {
    const recorder = new D1Recorder()
    const repository = new AuthRepository(recorder.db)
    const replacement = { ...session, id: 'ses_2' }

    await repository.rotateSession(session.id, 55, replacement)

    expect(recorder.batches).toHaveLength(1)
    expect(recorder.batches[0]).toHaveLength(2)
    expect(recorder.batches[0]?.[0]).toMatchObject({ values: [55, 55, session.id] })
    expect(recorder.batches[0]?.[0]?.sql).toContain('UPDATE auth_sessions')
    expect(recorder.batches[0]?.[1]?.values).toEqual([
      replacement.id,
      replacement.user_id,
      replacement.terminal_uuid,
      replacement.access_token_hash,
      replacement.refresh_token_hash,
      replacement.created_at,
      replacement.access_expires_at,
      replacement.refresh_expires_at,
      replacement.rotated_at,
      replacement.revoked_at,
    ])
  })
})