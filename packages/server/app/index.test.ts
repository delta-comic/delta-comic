import { describe, expect, it } from 'vitest'

import type { AppEnv } from './env'

import worker from './index'

const createExecutionContext = (): ExecutionContext =>
  ({ passThroughOnException() {}, waitUntil() {} }) as unknown as ExecutionContext

const createEnv = (overrides: Partial<AppEnv> = {}): AppEnv => ({
  ACCESS_TOKEN_TTL_SECONDS: '900',
  AUTH_PEPPER: 'auth-pepper',
  CF_VERSION_METADATA: { id: 'test-version', tag: 'test', timestamp: '2026-07-10T00:00:00.000Z' },
  DB: {} as D1Database,
  REFRESH_TOKEN_TTL_SECONDS: '2592000',
  SYNC_MAX_PULL_CHANGES: '500',
  SYNC_MAX_PUSH_OPS: '100',
  TOKEN_PEPPER: 'token-pepper',
  ...overrides,
})

const request = (path: string, init?: RequestInit) =>
  new Request(`https://delta.example${path}`, init)

const fetchWorker = (path: string, init?: RequestInit, env = createEnv()) =>
  worker.fetch(request(path, init), env, createExecutionContext())

describe('server Elysia app', () => {
  it('returns the health payload', async () => {
    const response = await fetchWorker('/api/health')

    await expect(response.json()).resolves.toEqual({
      data: { service: 'delta-comic-server', status: 'ok' },
      ok: true,
    })
    expect(response.status).toBe(200)
  })

  it('maps body validation failures to the unified API error shape', async () => {
    const response = await fetchWorker('/api/auth/login', {
      body: JSON.stringify({ loginName: 'ab' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    const payload = (await response.json()) as { error: { code: string }; ok: boolean }

    expect(response.status).toBe(400)
    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe('REQUEST_VALIDATION_FAILED')
  })

  it('uses the Elysia auth guard for protected routes', async () => {
    const response = await fetchWorker('/api/auth/me')

    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'AUTH_MISSING_TOKEN' },
      ok: false,
    })
    expect(response.status).toBe(401)
  })

  it('exposes OpenAPI schema under the API prefix', async () => {
    const response = await fetchWorker('/api/openapi/json')
    const payload = (await response.json()) as {
      info?: { title?: string }
      paths?: Record<string, unknown>
    }

    expect(response.status).toBe(200)
    expect(payload.info?.title).toBe('Delta Comic Server API')
    expect(payload.paths).toHaveProperty('/api/health')
  })
})