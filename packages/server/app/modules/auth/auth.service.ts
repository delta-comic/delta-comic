import { readNumberVar } from '@/env'
import { AppError } from '@/shared/errors'
import { createId, isUuid } from '@/shared/ids'
import { now as readNow } from '@/shared/time'

import { AuthRepository } from './auth.repository'
import { createPasswordRecord, verifyPassword } from './password'
import { createTokenPair, hashToken } from './token'

import type {
  AuthContext,
  AuthSessionRow,
  AuthTerminalRow,
  AuthTokensResponse,
  LoginRequest,
  RegisterRequest,
} from './auth.types'

const normalizeLoginName = (loginName: string): string => loginName.trim().toLowerCase()

const optionalString = (value: string | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export interface AuthServiceConfig {
  authPepper?: string
  tokenPepper?: string
  accessTtlSeconds?: string
  refreshTtlSeconds?: string
}

export class AuthService {
  private readonly authPepper: string
  private readonly tokenPepper: string
  private readonly accessTtlSeconds: number
  private readonly refreshTtlSeconds: number

  constructor(
    private readonly repository: AuthRepository,
    config: AuthServiceConfig,
  ) {
    this.authPepper = config.authPepper ?? ''
    this.tokenPepper = config.tokenPepper ?? ''
    this.accessTtlSeconds = readNumberVar(config.accessTtlSeconds, 900)
    this.refreshTtlSeconds = readNumberVar(config.refreshTtlSeconds, 2_592_000)
  }

  async register(input: RegisterRequest): Promise<AuthTokensResponse> {
    this.assertSecrets()
    this.assertTerminalUuid(input.terminalUuid)
    const loginName = normalizeLoginName(input.loginName)
    this.assertLoginName(loginName)

    const exists = await this.repository.findUserByLoginName(loginName)
    if (exists) throw new AppError('AUTH_LOGIN_NAME_EXISTS', 'login name already exists', 409)

    const current = readNow()
    const password = await createPasswordRecord(input.password, this.authPepper)
    const userId = createId('usr')
    await this.repository.createUser({
      created_at: current,
      disabled_at: null,
      id: userId,
      login_name: loginName,
      password_alg: password.alg,
      password_hash: password.hash,
      password_salt: password.salt,
      updated_at: current,
    })
    await this.upsertTerminal(userId, input, current)
    return await this.createSessionResponse(userId, loginName, input.terminalUuid, input.terminalName, current)
  }

  async login(input: LoginRequest): Promise<AuthTokensResponse> {
    this.assertSecrets()
    this.assertTerminalUuid(input.terminalUuid)
    const loginName = normalizeLoginName(input.loginName)
    const user = await this.repository.findUserByLoginName(loginName)
    if (!user || user.disabled_at !== null) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'invalid login name or password', 401)
    }

    const matched = await verifyPassword(
      input.password,
      user.password_salt,
      user.password_hash,
      user.password_alg,
      this.authPepper,
    )
    if (!matched) throw new AppError('AUTH_INVALID_CREDENTIALS', 'invalid login name or password', 401)

    const current = readNow()
    await this.upsertTerminal(user.id, input, current)
    return await this.createSessionResponse(user.id, user.login_name, input.terminalUuid, input.terminalName, current)
  }

  async refresh(refreshToken: string): Promise<AuthTokensResponse> {
    this.assertSecrets()
    const current = readNow()
    const tokenHash = await hashToken(refreshToken, this.tokenPepper)
    const session = await this.repository.findSessionByRefreshTokenHash(tokenHash)
    if (!session || session.revoked_at !== null || session.refresh_expires_at <= current) {
      throw new AppError('AUTH_TOKEN_EXPIRED', 'refresh token is expired or revoked', 401)
    }

    const user = await this.repository.findUserById(session.user_id)
    if (!user || user.disabled_at !== null) throw new AppError('AUTH_TOKEN_EXPIRED', 'user is disabled', 401)

    const terminal = await this.repository.findTerminal(session.user_id, session.terminal_uuid)
    if (!terminal || terminal.revoked_at !== null) {
      throw new AppError('AUTH_TERMINAL_REVOKED', 'terminal is revoked', 401)
    }

    const tokens = await createTokenPair(
      current,
      this.accessTtlSeconds,
      this.refreshTtlSeconds,
      this.tokenPepper,
    )
    const newSession: AuthSessionRow = {
      access_expires_at: tokens.accessExpiresAt,
      access_token_hash: tokens.accessTokenHash,
      created_at: current,
      id: createId('ses'),
      refresh_expires_at: tokens.refreshExpiresAt,
      refresh_token_hash: tokens.refreshTokenHash,
      revoked_at: null,
      rotated_at: null,
      terminal_uuid: session.terminal_uuid,
      user_id: session.user_id,
    }
    await this.repository.rotateSession(session.id, current, newSession)

    return this.toTokenResponse(user.id, user.login_name, terminal.terminal_uuid, terminal.display_name, tokens)
  }

  async logout(auth: AuthContext): Promise<{ loggedOut: true }> {
    await this.repository.revokeSession(auth.sessionId, readNow())
    return { loggedOut: true }
  }

  async authenticateAccessToken(accessToken: string): Promise<AuthContext> {
    this.assertSecrets()
    const current = readNow()
    const tokenHash = await hashToken(accessToken, this.tokenPepper)
    const session = await this.repository.findSessionByAccessTokenHash(tokenHash)
    if (!session || session.revoked_at !== null || session.access_expires_at <= current) {
      throw new AppError('AUTH_TOKEN_EXPIRED', 'access token is expired or revoked', 401)
    }
    const user = await this.repository.findUserById(session.user_id)
    if (!user || user.disabled_at !== null) throw new AppError('AUTH_TOKEN_EXPIRED', 'user is disabled', 401)
    const terminal = await this.repository.findTerminal(session.user_id, session.terminal_uuid)
    if (!terminal || terminal.revoked_at !== null) {
      throw new AppError('AUTH_TERMINAL_REVOKED', 'terminal is revoked', 401)
    }
    return {
      loginName: user.login_name,
      sessionId: session.id,
      terminalUuid: session.terminal_uuid,
      userId: session.user_id,
    }
  }

  async me(auth: AuthContext) {
    const terminal = await this.repository.findTerminal(auth.userId, auth.terminalUuid)
    return {
      terminal: {
        appVersion: terminal?.app_version ?? undefined,
        displayName: terminal?.display_name ?? undefined,
        platform: terminal?.platform ?? undefined,
        terminalUuid: auth.terminalUuid,
      },
      user: {
        id: auth.userId,
        loginName: auth.loginName,
      },
    }
  }

  private assertSecrets() {
    if (!this.authPepper) throw new AppError('CONFIG_MISSING_AUTH_PEPPER', 'AUTH_PEPPER is not configured', 500)
    if (!this.tokenPepper) throw new AppError('CONFIG_MISSING_TOKEN_PEPPER', 'TOKEN_PEPPER is not configured', 500)
  }

  private assertTerminalUuid(terminalUuid: string) {
    if (!isUuid(terminalUuid)) throw new AppError('AUTH_INVALID_TERMINAL_UUID', 'terminalUuid must be a UUID', 400)
  }

  private assertLoginName(loginName: string) {
    if (loginName.length < 3 || loginName.length > 64) {
      throw new AppError('AUTH_INVALID_LOGIN_NAME', 'loginName length must be between 3 and 64', 400)
    }
  }

  private async upsertTerminal(userId: string, input: LoginRequest | RegisterRequest, current: number) {
    const terminal: AuthTerminalRow = {
      app_version: optionalString(input.appVersion),
      created_at: current,
      display_name: optionalString(input.terminalName),
      last_seen_at: current,
      platform: optionalString(input.platform),
      revoked_at: null,
      terminal_uuid: input.terminalUuid,
      user_id: userId,
    }
    await this.repository.upsertTerminal(terminal)
  }

  private async createSessionResponse(
    userId: string,
    loginName: string,
    terminalUuid: string,
    terminalName: string | undefined,
    current: number,
  ): Promise<AuthTokensResponse> {
    const tokens = await createTokenPair(
      current,
      this.accessTtlSeconds,
      this.refreshTtlSeconds,
      this.tokenPepper,
    )
    await this.repository.createSession({
      access_expires_at: tokens.accessExpiresAt,
      access_token_hash: tokens.accessTokenHash,
      created_at: current,
      id: createId('ses'),
      refresh_expires_at: tokens.refreshExpiresAt,
      refresh_token_hash: tokens.refreshTokenHash,
      revoked_at: null,
      rotated_at: null,
      terminal_uuid: terminalUuid,
      user_id: userId,
    })
    return this.toTokenResponse(userId, loginName, terminalUuid, optionalString(terminalName), tokens)
  }

  private toTokenResponse(
    userId: string,
    loginName: string,
    terminalUuid: string,
    displayName: string | null,
    tokens: {
      accessToken: string
      accessExpiresAt: number
      refreshToken: string
      refreshExpiresAt: number
    },
  ): AuthTokensResponse {
    return {
      terminal: {
        ...(displayName ? { displayName } : {}),
        terminalUuid,
      },
      tokens,
      user: {
        id: userId,
        loginName,
      },
    }
  }
}

export const createAuthService = (db: D1Database, config: AuthServiceConfig): AuthService =>
  new AuthService(new AuthRepository(db), config)