import { describe, expect, it, vi } from 'vitest'

import { AdminApiClient } from './AdminApiClient'

describe('AdminApiClient', () => {
  it('binds the browser fetch implementation to the global receiver', async () => {
    const fetcher = vi.fn(function (this: unknown) {
      expect(this).toBe(globalThis)
      return Promise.resolve(Response.json({ data: { connected: true }, ok: true }))
    })
    vi.stubGlobal('fetch', fetcher)

    try {
      const client = new AdminApiClient({ baseUrl: 'https://server.example' })
      await expect(client.get('/api/admin/capabilities')).resolves.toEqual({ connected: true })
      expect(fetcher).toHaveBeenCalledOnce()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('sends the session token and unwraps a success envelope', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer admin-token')
      return Response.json({ data: { ready: true }, ok: true })
    })
    const client = new AdminApiClient({
      baseUrl: 'https://server.example',
      fetcher,
      getToken: () => 'admin-token',
    })

    await expect(client.get<{ ready: boolean }>('/api/admin/health/ready')).resolves.toEqual({
      ready: true,
    })
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('normalizes a structured API failure', async () => {
    const client = new AdminApiClient({
      baseUrl: 'https://server.example',
      fetcher: async () =>
        Response.json(
          { error: { code: 'ADMIN_UNAUTHORIZED', message: 'unauthorized' }, ok: false },
          { status: 401 },
        ),
    })

    await expect(client.get('/api/admin/overview')).rejects.toMatchObject({
      code: 'ADMIN_UNAUTHORIZED',
      message: 'unauthorized',
      status: 401,
    })
  })

  it('rejects an invalid response envelope', async () => {
    const client = new AdminApiClient({
      baseUrl: 'https://server.example',
      fetcher: async () => Response.json({ status: 'ok' }),
    })

    await expect(client.get('/api/admin/overview')).rejects.toMatchObject({
      code: 'ADMIN_INVALID_ENVELOPE',
    })
  })
})