import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CloudAuthClient } from '../../lib/auth'
import { CloudConfigurationError, CloudUnauthenticatedError } from '../../lib/errors'
import type { CloudHttpClient } from '../../lib/http'
import { MemoryCloudSessionStorage } from '../../lib/storage'
import type { CloudSession } from '../../lib/types'

const createSession = (overrides: Partial<CloudSession['tokens']> = {}): CloudSession => ({
  terminal: { terminalUuid: 'terminal-1' },
  tokens: {
    accessExpiresAt: 1_700_000_060_000,
    accessToken: 'access-token',
    refreshExpiresAt: 1_700_000_120_000,
    refreshToken: 'refresh-token',
    ...overrides,
  },
  user: { id: 'user-1', loginName: 'alice' },
})

const createHttp = () => ({ get: vi.fn(), post: vi.fn() })

describe('CloudAuthClient', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_700_000_000_000)
  })

  it('logs in and registers with resolved terminal metadata and persists each session', async () => {
    const http = createHttp()
    const storage = new MemoryCloudSessionStorage()
    const first = createSession()
    const second = createSession({ accessToken: 'registered-access' })
    http.post.mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    const terminalProvider = vi.fn(async () => ({
      appVersion: '1.0.0',
      platform: 'desktop',
      terminalName: 'default',
      terminalUuid: 'terminal-default',
    }))
    const auth = new CloudAuthClient(http as unknown as CloudHttpClient, storage, terminalProvider)

    await expect(
      auth.login({ loginName: 'alice', password: 'password', terminalName: 'override' }),
    ).resolves.toBe(first)
    await expect(auth.register({ loginName: 'bob', password: 'password' })).resolves.toBe(second)

    expect(http.post).toHaveBeenNthCalledWith(
      1,
      'auth/login',
      expect.objectContaining({
        loginName: 'alice',
        terminalName: 'override',
        terminalUuid: 'terminal-default',
      }),
      { auth: false },
    )
    expect(http.post).toHaveBeenNthCalledWith(
      2,
      'auth/register',
      expect.objectContaining({ loginName: 'bob', terminalName: 'default' }),
      { auth: false },
    )
    await expect(auth.getSession()).resolves.toBe(second)
    expect(terminalProvider).toHaveBeenCalledTimes(2)
  })

  it('requires a terminal provider and a nonempty resolved uuid', async () => {
    const http = createHttp()
    const storage = new MemoryCloudSessionStorage()

    await expect(
      new CloudAuthClient(http as unknown as CloudHttpClient, storage).login({
        loginName: 'alice',
        password: 'password',
      }),
    ).rejects.toBeInstanceOf(CloudConfigurationError)
    await expect(
      new CloudAuthClient(http as unknown as CloudHttpClient, storage, {
        terminalUuid: '',
      }).register({ loginName: 'alice', password: 'password' }),
    ).rejects.toThrow('cloud terminal uuid is missing')
    expect(http.post).not.toHaveBeenCalled()
  })

  it('reports authentication from refresh lifetime, not access lifetime', async () => {
    const http = createHttp()
    const storage = new MemoryCloudSessionStorage()
    const auth = new CloudAuthClient(http as unknown as CloudHttpClient, storage, undefined, 0)

    await expect(auth.isAuthenticated()).resolves.toBe(false)
    await storage.setSession(createSession({ accessExpiresAt: 1 }))
    await expect(auth.isAuthenticated()).resolves.toBe(true)
    await storage.setSession(createSession({ refreshExpiresAt: 1 }))
    await expect(auth.isAuthenticated()).resolves.toBe(false)
  })

  it('deduplicates concurrent refreshes and persists the rotated session', async () => {
    const http = createHttp()
    const storage = new MemoryCloudSessionStorage()
    await storage.setSession(createSession())
    let resolveRefresh!: (session: CloudSession) => void
    http.post.mockReturnValue(
      new Promise<CloudSession>(resolve => {
        resolveRefresh = resolve
      }),
    )
    const auth = new CloudAuthClient(http as unknown as CloudHttpClient, storage, undefined, 0)

    const first = auth.refresh()
    const second = auth.refresh('ignored-concurrent-token')
    const rotated = createSession({
      accessToken: 'rotated-access',
      refreshToken: 'rotated-refresh',
    })
    resolveRefresh(rotated)

    await expect(first).resolves.toBe(rotated)
    await expect(second).resolves.toBe(rotated)
    expect(http.post).toHaveBeenCalledOnce()
    expect(http.post).toHaveBeenCalledWith(
      'auth/refresh',
      { refreshToken: 'refresh-token' },
      { auth: false },
    )
    await expect(storage.getSession()).resolves.toBe(rotated)
  })

  it('clears refresh state after failure so a later retry can succeed', async () => {
    const http = createHttp()
    const storage = new MemoryCloudSessionStorage()
    const rotated = createSession({ accessToken: 'new-access' })
    http.post.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(rotated)
    const auth = new CloudAuthClient(http as unknown as CloudHttpClient, storage)

    await expect(auth.refresh('explicit-token')).rejects.toThrow('network')
    await expect(auth.refresh('explicit-token')).resolves.toBe(rotated)
    expect(http.post).toHaveBeenCalledTimes(2)
  })

  it('returns a valid access token and refreshes one inside the configured leeway', async () => {
    const http = createHttp()
    const storage = new MemoryCloudSessionStorage()
    const auth = new CloudAuthClient(http as unknown as CloudHttpClient, storage, undefined, 30_000)

    await expect(auth.ensureAccessToken()).rejects.toBeInstanceOf(CloudUnauthenticatedError)

    await storage.setSession(createSession())
    await expect(auth.ensureAccessToken()).resolves.toBe('access-token')

    await storage.setSession(createSession({ accessExpiresAt: 1_700_000_010_000 }))
    http.post.mockResolvedValue(createSession({ accessToken: 'refreshed-access' }))
    await expect(auth.ensureAccessToken()).resolves.toBe('refreshed-access')
  })

  it('clears an expired refresh session before rejecting', async () => {
    const http = createHttp()
    const storage = new MemoryCloudSessionStorage()
    await storage.setSession(createSession({ refreshExpiresAt: 1_700_000_000_000 }))
    const clear = vi.spyOn(storage, 'clearSession')
    const auth = new CloudAuthClient(http as unknown as CloudHttpClient, storage)

    await expect(auth.ensureAccessToken()).rejects.toThrow('cloud refresh token has expired')
    expect(clear).toHaveBeenCalledOnce()
    await expect(storage.getSession()).resolves.toBeNull()
  })

  it('requires refresh credentials and clears storage only after successful logout', async () => {
    const http = createHttp()
    const storage = new MemoryCloudSessionStorage()
    const auth = new CloudAuthClient(http as unknown as CloudHttpClient, storage, undefined, 0)

    await expect(auth.refresh()).rejects.toThrow('cloud refresh token is missing')

    await storage.setSession(createSession())
    http.post.mockResolvedValue({ loggedOut: true })
    await expect(auth.logout()).resolves.toEqual({ loggedOut: true })
    expect(http.post).toHaveBeenCalledWith('auth/logout')
    await expect(storage.getSession()).resolves.toBeNull()
  })

  it('loads the current profile only after validating session lifetime', async () => {
    const http = createHttp()
    const storage = new MemoryCloudSessionStorage()
    await storage.setSession(createSession())
    http.get.mockResolvedValue({
      terminal: { displayName: 'phone', terminalUuid: 'terminal-1' },
      user: { id: 'user-1', loginName: 'alice' },
    })
    const auth = new CloudAuthClient(http as unknown as CloudHttpClient, storage, undefined, 0)

    await expect(auth.me()).resolves.toMatchObject({ user: { loginName: 'alice' } })
    expect(http.get).toHaveBeenCalledWith('auth/me')
  })
})