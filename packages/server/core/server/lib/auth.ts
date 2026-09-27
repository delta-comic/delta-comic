import { DEFAULT_TOKEN_REFRESH_LEEWAY } from './constants'
import { CloudConfigurationError, CloudUnauthenticatedError } from './errors'
import type { CloudHttpClient } from './http'
import type { CloudSessionStorage } from './storage'
import type {
  CloudLoginInput,
  CloudRefreshRequest,
  CloudRegisterInput,
  CloudSession,
  CloudTerminalInput,
  CloudTerminalProvider,
} from './types'

export class CloudAuthClient {
  private refreshPromise: Promise<CloudSession> | undefined

  constructor(
    private readonly http: CloudHttpClient,
    private readonly storage: CloudSessionStorage,
    private readonly terminalProvider?: CloudTerminalProvider,
    private readonly refreshLeeway = DEFAULT_TOKEN_REFRESH_LEEWAY,
  ) {}

  async getSession(): Promise<CloudSession | null> {
    return await this.storage.getSession()
  }

  async isAuthenticated(): Promise<boolean> {
    const session = await this.storage.getSession()
    return Boolean(session && session.tokens.refreshExpiresAt > Date.now())
  }

  async login(input: CloudLoginInput): Promise<CloudSession> {
    const session = await this.http.post<CloudSession>(
      'auth/login',
      await this.withTerminal(input),
      { auth: false },
    )
    await this.storage.setSession(session)
    return session
  }

  async register(input: CloudRegisterInput): Promise<CloudSession> {
    const session = await this.http.post<CloudSession>(
      'auth/register',
      await this.withTerminal(input),
      { auth: false },
    )
    await this.storage.setSession(session)
    return session
  }

  async refresh(refreshToken?: CloudRefreshRequest['refreshToken']): Promise<CloudSession> {
    const current = await this.storage.getSession()
    const token = refreshToken ?? current?.tokens.refreshToken
    if (!token) throw new CloudUnauthenticatedError('cloud refresh token is missing')
    if (this.refreshPromise) return await this.refreshPromise
    this.refreshPromise = this.http
      .post<CloudSession>('auth/refresh', { refreshToken: token }, { auth: false })
      .then(async session => {
        await this.storage.setSession(session)
        return session
      })
      .finally(() => {
        this.refreshPromise = undefined
      })
    return await this.refreshPromise
  }

  async ensureAccessToken(): Promise<string> {
    const session = await this.storage.getSession()
    if (!session) throw new CloudUnauthenticatedError()
    const now = Date.now()
    if (session.tokens.refreshExpiresAt <= now) {
      await this.storage.clearSession()
      throw new CloudUnauthenticatedError('cloud refresh token has expired')
    }
    if (session.tokens.accessExpiresAt <= now + this.refreshLeeway) {
      return (await this.refresh(session.tokens.refreshToken)).tokens.accessToken
    }
    return session.tokens.accessToken
  }

  async logout(): Promise<{ loggedOut: true }> {
    await this.ensureAccessToken()
    const result = await this.http.post<{ loggedOut: true }>('auth/logout')
    await this.storage.clearSession()
    return result
  }

  async me(): Promise<{
    terminal: CloudTerminalInput & { displayName?: string }
    user: CloudSession['user']
  }> {
    await this.ensureAccessToken()
    return await this.http.get('auth/me')
  }

  private async resolveTerminal(): Promise<CloudTerminalInput> {
    if (!this.terminalProvider) {
      throw new CloudConfigurationError('cloud terminal provider is missing')
    }
    return typeof this.terminalProvider === 'function'
      ? await this.terminalProvider()
      : this.terminalProvider
  }

  private async withTerminal<T extends Partial<CloudTerminalInput>>(
    input: T,
  ): Promise<T & CloudTerminalInput> {
    const terminal = await this.resolveTerminal()
    const merged = { ...terminal, ...input }
    if (!merged.terminalUuid) throw new CloudConfigurationError('cloud terminal uuid is missing')
    return merged as T & CloudTerminalInput
  }
}