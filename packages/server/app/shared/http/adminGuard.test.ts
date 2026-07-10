import Elysia from 'elysia'
import { describe, expect, it } from 'vitest'

import { bindRuntime, type AppEnv } from '@/env'
import { errorResponse } from '@/shared/response'

import { adminGuard } from './adminGuard'

const createExecutionContext = (): ExecutionContext =>
  ({ passThroughOnException() {}, waitUntil() {} }) as unknown as ExecutionContext

const createEnv = (overrides: Partial<AppEnv> = {}): AppEnv => ({
  ACCESS_TOKEN_TTL_SECONDS: '900',
  AUTH_PEPPER: 'auth-pepper',
  CF_VERSION_METADATA: { id: 'version-id', tag: 'test', timestamp: '2026-07-10T00:00:00Z' },
  DB: {} as D1Database,
  REFRESH_TOKEN_TTL_SECONDS: '2592000',
  SERVER_ADMIN_TOKEN: 'admin-secret',
  SYNC_MAX_PULL_CHANGES: '500',
  SYNC_MAX_PUSH_OPS: '100',
  TOKEN_PEPPER: 'token-pepper',
  ...overrides,
})

const app = new Elysia()
  .onError(({ code, error }) => errorResponse(error, code))
  .use(adminGuard)
  .get('/protected', ({ admin }) => admin)

const requestGuard = (authorization?: string, env = createEnv()) => {
  const request = new Request('https://delta.example/protected', {
    headers: authorization ? { authorization } : undefined,
  })
  bindRuntime(request, { ctx: createExecutionContext(), env })
  return app.handle(request)
}

describe('adminGuard', () => {
  it('returns 503 when SERVER_ADMIN_TOKEN is not configured', async () => {
    const response = await requestGuard('Bearer anything', createEnv({ SERVER_ADMIN_TOKEN: '' }))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'ADMIN_TOKEN_NOT_CONFIGURED' },
      ok: false,
    })
  })

  it('returns 401 for a missing or incorrect Bearer token', async () => {
    const missing = await requestGuard()
    const incorrect = await requestGuard('Bearer wrong-secret')

    expect(missing.status).toBe(401)
    expect(incorrect.status).toBe(401)
    expect(missing.headers.get('www-authenticate')).toBe('Bearer realm="delta-comic-admin"')
    await expect(incorrect.json()).resolves.toMatchObject({
      error: { code: 'ADMIN_UNAUTHORIZED' },
      ok: false,
    })
  })

  it('accepts the independently configured administrator Bearer token', async () => {
    const response = await requestGuard('Bearer admin-secret')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ authenticated: true })
  })
})