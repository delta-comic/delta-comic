import { describe, expect, it, vi } from 'vitest'

import { authRoutes } from '../../../../app/modules/auth/auth.routes'

interface RouteRecord {
  handler: (context: Record<string, unknown>) => unknown
  path: string
}

const findRoute = (path: string): RouteRecord => {
  const routes = (authRoutes as unknown as { routes: RouteRecord[] }).routes
  const route = routes.find(candidate => candidate.path.endsWith(path))
  if (!route) throw new Error(`auth route not found: ${path}`)
  return route
}

describe('auth route handlers', () => {
  it('delegates public auth payloads and wraps successful results', async () => {
    const authService = {
      login: vi.fn(async body => ({ kind: 'login', body })),
      refresh: vi.fn(async token => ({ kind: 'refresh', token })),
      register: vi.fn(async body => ({ kind: 'register', body })),
    }
    const registerBody = { loginName: 'alice' }
    const loginBody = { loginName: 'alice', password: 'secret' }

    await expect(
      findRoute('/register').handler({ authService, body: registerBody }),
    ).resolves.toEqual({ data: { body: registerBody, kind: 'register' }, ok: true })
    await expect(findRoute('/login').handler({ authService, body: loginBody })).resolves.toEqual({
      data: { body: loginBody, kind: 'login' },
      ok: true,
    })
    await expect(
      findRoute('/refresh').handler({ authService, body: { refreshToken: 'refresh-token' } }),
    ).resolves.toEqual({ data: { kind: 'refresh', token: 'refresh-token' }, ok: true })
    expect(authService.refresh).toHaveBeenCalledExactlyOnceWith('refresh-token')
  })

  it('passes the resolved auth context to protected logout and profile handlers', async () => {
    const auth = { sessionId: 'session-1', userId: 'user-1' }
    const authService = {
      logout: vi.fn(async context => ({ context, loggedOut: true })),
      me: vi.fn(async context => ({ context, profile: true })),
    }

    await expect(findRoute('/logout').handler({ auth, authService })).resolves.toEqual({
      data: { context: auth, loggedOut: true },
      ok: true,
    })
    await expect(findRoute('/me').handler({ auth, authService })).resolves.toEqual({
      data: { context: auth, profile: true },
      ok: true,
    })
    expect(authService.logout).toHaveBeenCalledExactlyOnceWith(auth)
    expect(authService.me).toHaveBeenCalledExactlyOnceWith(auth)
  })
})