import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppError } from '@/shared/errors'

import type { AuthRepository } from '../../../../app/modules/auth/auth.repository'
import { AuthService } from '../../../../app/modules/auth/auth.service'
import type {
  AuthSessionRow,
  AuthTerminalRow,
  AuthUserRow,
} from '../../../../app/modules/auth/auth.types'
import { createPasswordRecord } from '../../../../app/modules/auth/password'
import { hashToken } from '../../../../app/modules/auth/token'

const terminalUuid = '00000000-0000-4000-8000-000000000001'
const pepper = 'auth-pepper'
const tokenPepper = 'token-pepper'

class MemoryAuthRepository {
  readonly users = new Map<string, AuthUserRow>()
  readonly terminals = new Map<string, AuthTerminalRow>()
  readonly sessions = new Map<string, AuthSessionRow>()
  rotated?: { newSession: AuthSessionRow; oldRotatedAt: number; oldSessionId: string }

  async findUserByLoginName(loginName: string) {
    return [...this.users.values()].find(user => user.login_name === loginName) ?? null
  }

  async findUserById(id: string) {
    return this.users.get(id) ?? null
  }

  async createUser(row: AuthUserRow) {
    this.users.set(row.id, { ...row })
  }

  async upsertTerminal(row: AuthTerminalRow) {
    this.terminals.set(`${row.user_id}:${row.terminal_uuid}`, { ...row })
  }

  async findTerminal(userId: string, uuid: string) {
    return this.terminals.get(`${userId}:${uuid}`) ?? null
  }

  async createSession(row: AuthSessionRow) {
    this.sessions.set(row.id, { ...row })
  }

  async findSessionByAccessTokenHash(hash: string) {
    return [...this.sessions.values()].find(session => session.access_token_hash === hash) ?? null
  }

  async findSessionByRefreshTokenHash(hash: string) {
    return [...this.sessions.values()].find(session => session.refresh_token_hash === hash) ?? null
  }

  async revokeSession(sessionId: string, revokedAt: number) {
    const session = this.sessions.get(sessionId)
    if (session) session.revoked_at = revokedAt
  }

  async rotateSession(oldSessionId: string, oldRotatedAt: number, newSession: AuthSessionRow) {
    this.rotated = { newSession, oldRotatedAt, oldSessionId }
    const old = this.sessions.get(oldSessionId)
    if (old) {
      old.rotated_at = oldRotatedAt
      old.revoked_at = oldRotatedAt
    }
    this.sessions.set(newSession.id, { ...newSession })
  }
}

const createService = (repository = new MemoryAuthRepository()) => ({
  repository,
  service: new AuthService(repository as unknown as AuthRepository, {
    accessTtlSeconds: '60',
    authPepper: pepper,
    refreshTtlSeconds: '120',
    tokenPepper,
  }),
})

const registerInput = {
  appVersion: ' 1.2.3 ',
  loginName: ' Alice ',
  password: 'correct horse battery staple',
  platform: ' desktop ',
  terminalName: ' Main terminal ',
  terminalUuid,
}

const expectAppError = async (promise: Promise<unknown>, code: string, status: number) => {
  await expect(promise).rejects.toMatchObject({ code, status } satisfies Partial<AppError>)
}

describe('AuthService', () => {
  beforeEach(() => vi.useRealTimers())

  it('normalizes registration data and persists a usable terminal session', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_700_000_000_000)
    const { repository, service } = createService()

    const result = await service.register(registerInput)

    expect(result.user.loginName).toBe('alice')
    expect(result.terminal).toEqual({ displayName: 'Main terminal', terminalUuid })
    expect(result.tokens.accessExpiresAt).toBe(1_700_000_060_000)
    expect(result.tokens.refreshExpiresAt).toBe(1_700_000_120_000)
    expect(repository.users.values().next().value).toMatchObject({
      disabled_at: null,
      login_name: 'alice',
      password_alg: 'pbkdf2-sha256:210000',
    })
    expect(repository.terminals.values().next().value).toMatchObject({
      app_version: '1.2.3',
      display_name: 'Main terminal',
      platform: 'desktop',
      revoked_at: null,
    })
    expect(repository.sessions.values().next().value).toMatchObject({
      terminal_uuid: terminalUuid,
      user_id: result.user.id,
    })
  })

  it('rejects unsafe configuration and malformed registration identities before persistence', async () => {
    const repository = new MemoryAuthRepository()
    const missingSecret = new AuthService(repository as unknown as AuthRepository, {
      authPepper: '',
      tokenPepper,
    })
    await expectAppError(missingSecret.register(registerInput), 'CONFIG_MISSING_AUTH_PEPPER', 500)

    const missingTokenSecret = new AuthService(repository as unknown as AuthRepository, {
      authPepper: pepper,
      tokenPepper: '',
    })
    await expectAppError(
      missingTokenSecret.register(registerInput),
      'CONFIG_MISSING_TOKEN_PEPPER',
      500,
    )

    const { service } = createService(repository)
    await expectAppError(
      service.register({ ...registerInput, terminalUuid: 'not-a-uuid' }),
      'AUTH_INVALID_TERMINAL_UUID',
      400,
    )
    await expectAppError(
      service.register({ ...registerInput, loginName: ' x ' }),
      'AUTH_INVALID_LOGIN_NAME',
      400,
    )
    expect(repository.users).toHaveLength(0)
  })

  it('rejects duplicate normalized login names', async () => {
    const { service } = createService()
    await service.register(registerInput)

    await expectAppError(
      service.register({ ...registerInput, loginName: 'ALICE' }),
      'AUTH_LOGIN_NAME_EXISTS',
      409,
    )
  })

  it('authenticates a valid password and refreshes optional terminal metadata', async () => {
    const { repository, service } = createService()
    const registered = await service.register(registerInput)

    const result = await service.login({
      loginName: ' ALICE ',
      password: registerInput.password,
      platform: 'android',
      terminalName: ' ',
      terminalUuid,
    })

    expect(result.user).toEqual(registered.user)
    expect(result.terminal).toEqual({ terminalUuid })
    expect(repository.terminals.get(`${result.user.id}:${terminalUuid}`)).toMatchObject({
      app_version: null,
      display_name: null,
      platform: 'android',
    })
    expect(repository.sessions).toHaveLength(2)
  })

  it('uses the same invalid-credentials error for unknown, disabled, and wrong-password users', async () => {
    const { repository, service } = createService()
    await expectAppError(service.login(registerInput), 'AUTH_INVALID_CREDENTIALS', 401)

    const password = await createPasswordRecord(registerInput.password, pepper)
    repository.users.set('disabled', {
      created_at: 1,
      disabled_at: 2,
      id: 'disabled',
      login_name: 'alice',
      password_alg: password.alg,
      password_hash: password.hash,
      password_salt: password.salt,
      updated_at: 1,
    })
    await expectAppError(service.login(registerInput), 'AUTH_INVALID_CREDENTIALS', 401)

    repository.users.get('disabled')!.disabled_at = null
    await expectAppError(
      service.login({ ...registerInput, password: 'wrong password' }),
      'AUTH_INVALID_CREDENTIALS',
      401,
    )
  })

  it('rotates a valid refresh token and invalidates the previous session', async () => {
    const { repository, service } = createService()
    const registered = await service.register(registerInput)
    const oldSession = repository.sessions.values().next().value as AuthSessionRow

    const refreshed = await service.refresh(registered.tokens.refreshToken)

    expect(refreshed.tokens.refreshToken).not.toBe(registered.tokens.refreshToken)
    expect(repository.rotated).toMatchObject({ oldSessionId: oldSession.id })
    expect(oldSession.revoked_at).not.toBeNull()
    expect(repository.sessions).toHaveLength(2)
  })

  it('rejects unknown, revoked, expired, disabled-user, and revoked-terminal refresh sessions', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_700_000_000_000)
    const { repository, service } = createService()
    await expectAppError(service.refresh('unknown-token'), 'AUTH_TOKEN_EXPIRED', 401)

    const registered = await service.register(registerInput)
    const session = repository.sessions.values().next().value as AuthSessionRow
    session.revoked_at = 1
    await expectAppError(service.refresh(registered.tokens.refreshToken), 'AUTH_TOKEN_EXPIRED', 401)

    session.revoked_at = null
    session.refresh_expires_at = 1
    await expectAppError(service.refresh(registered.tokens.refreshToken), 'AUTH_TOKEN_EXPIRED', 401)

    session.refresh_expires_at = Number.MAX_SAFE_INTEGER
    repository.users.get(registered.user.id)!.disabled_at = 1
    await expectAppError(service.refresh(registered.tokens.refreshToken), 'AUTH_TOKEN_EXPIRED', 401)

    repository.users.get(registered.user.id)!.disabled_at = null
    repository.terminals.get(`${registered.user.id}:${terminalUuid}`)!.revoked_at = 1
    await expectAppError(
      service.refresh(registered.tokens.refreshToken),
      'AUTH_TERMINAL_REVOKED',
      401,
    )
  })

  it('authenticates access tokens only for active users, sessions, and terminals', async () => {
    const { repository, service } = createService()
    await expectAppError(service.authenticateAccessToken('unknown'), 'AUTH_TOKEN_EXPIRED', 401)

    const registered = await service.register(registerInput)
    const auth = await service.authenticateAccessToken(registered.tokens.accessToken)
    expect(auth).toEqual({
      loginName: 'alice',
      sessionId: expect.stringMatching(/^ses_/),
      terminalUuid,
      userId: registered.user.id,
    })

    const hash = await hashToken(registered.tokens.accessToken, tokenPepper)
    const session = await repository.findSessionByAccessTokenHash(hash)
    expect.assert(session)
    session.access_expires_at = 0
    await expectAppError(
      service.authenticateAccessToken(registered.tokens.accessToken),
      'AUTH_TOKEN_EXPIRED',
      401,
    )

    session.access_expires_at = Number.MAX_SAFE_INTEGER
    repository.users.get(auth.userId)!.disabled_at = 1
    await expectAppError(
      service.authenticateAccessToken(registered.tokens.accessToken),
      'AUTH_TOKEN_EXPIRED',
      401,
    )

    repository.users.get(auth.userId)!.disabled_at = null
    repository.terminals.delete(`${auth.userId}:${terminalUuid}`)
    await expectAppError(
      service.authenticateAccessToken(registered.tokens.accessToken),
      'AUTH_TERMINAL_REVOKED',
      401,
    )
  })

  it('revokes the current session on logout and returns sparse terminal details from me', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_700_000_000_000)
    const { repository, service } = createService()
    const registered = await service.register(registerInput)
    const auth = await service.authenticateAccessToken(registered.tokens.accessToken)

    expect(await service.me(auth)).toMatchObject({
      terminal: {
        appVersion: '1.2.3',
        displayName: 'Main terminal',
        platform: 'desktop',
        terminalUuid,
      },
      user: { id: auth.userId, loginName: 'alice' },
    })
    repository.terminals.delete(`${auth.userId}:${terminalUuid}`)
    expect(await service.me(auth)).toEqual({
      terminal: {
        appVersion: undefined,
        displayName: undefined,
        platform: undefined,
        terminalUuid,
      },
      user: { id: auth.userId, loginName: 'alice' },
    })

    await expect(service.logout(auth)).resolves.toEqual({ loggedOut: true })
    expect(repository.sessions.get(auth.sessionId)?.revoked_at).toBe(1_700_000_000_000)
  })
})