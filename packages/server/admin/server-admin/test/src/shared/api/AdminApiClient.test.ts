import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  AdminApiClient,
  AdminApiError,
  readableApiError,
} from '../../../../src/shared/api/AdminApiClient'

afterEach(() => vi.useRealTimers())

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

  it('sends JSON payloads with PUT requests', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.method).toBe('PUT')
      expect(new Headers(init?.headers).get('content-type')).toBe('application/json')
      expect(init?.body).toBe('{"enabled":true}')
      return Response.json({ data: { saved: true }, ok: true })
    })
    const client = new AdminApiClient({ baseUrl: 'https://server.example', fetcher })

    await expect(client.put('/plugin/script', { enabled: true })).resolves.toEqual({ saved: true })
  })

  it.each([
    ['POST', 'post'],
    ['PATCH', 'patch'],
  ] as const)('sends JSON payloads with %s requests', async (method, call) => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(input).toBe('https://server.example/api/item')
      expect(init?.method).toBe(method)
      expect(init?.body).toBe('{"value":1}')
      return Response.json({ data: method, ok: true })
    })
    const client = new AdminApiClient({ baseUrl: 'https://server.example/', fetcher })

    await expect(client[call]('/api/item', { value: 1 })).resolves.toBe(method)
  })

  it('sends DELETE without a JSON body or content type', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.method).toBe('DELETE')
      expect(init?.body).toBeUndefined()
      expect(new Headers(init?.headers).has('content-type')).toBe(false)
      return Response.json({ data: true, ok: true })
    })
    const client = new AdminApiClient({ baseUrl: 'https://server.example', fetcher })

    await expect(client.delete('/api/item')).resolves.toBe(true)
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

  it('distinguishes invalid JSON from a valid but invalid envelope', async () => {
    const client = new AdminApiClient({
      baseUrl: 'https://server.example',
      fetcher: async () => new Response('not json', { status: 502 }),
    })

    await expect(client.get('/api/admin/overview')).rejects.toMatchObject({
      code: 'ADMIN_INVALID_RESPONSE',
      status: 502,
    })
  })

  it('rejects an unsuccessful HTTP response even with a success envelope', async () => {
    const client = new AdminApiClient({
      baseUrl: 'https://server.example',
      fetcher: async () => Response.json({ data: null, ok: true }, { status: 503 }),
    })

    await expect(client.get('/api/admin/overview')).rejects.toMatchObject({
      code: 'ADMIN_HTTP_ERROR',
      status: 503,
    })
  })

  it('wraps transport failures while preserving their message', async () => {
    const client = new AdminApiClient({
      baseUrl: 'https://server.example',
      fetcher: async () => {
        throw new Error('socket closed')
      },
    })

    await expect(client.get('/api/admin/overview')).rejects.toMatchObject({
      code: 'ADMIN_REQUEST_FAILED',
      message: 'socket closed',
    })
  })

  it('aborts a request when the caller signal is cancelled', async () => {
    const caller = new AbortController()
    const fetcher = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    )
    const client = new AdminApiClient({ baseUrl: 'https://server.example', fetcher })
    const request = client.get('/slow', caller.signal)

    caller.abort(new Error('cancelled by user'))

    await expect(request).rejects.toMatchObject({ code: 'ADMIN_REQUEST_ABORTED' })
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
  })

  it('reports its own timeout separately from caller cancellation', async () => {
    vi.useFakeTimers()
    const client = new AdminApiClient({
      baseUrl: 'https://server.example',
      fetcher: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted')))
        }),
      timeout: 25,
    })
    const request = client.get('/slow')
    const rejection = expect(request).rejects.toMatchObject({ code: 'ADMIN_REQUEST_TIMEOUT' })

    await vi.advanceTimersByTimeAsync(25)

    await rejection
  })

  it('formats known, native, and non-error failures for the UI', () => {
    expect(readableApiError(new AdminApiError('NOPE', 'known failure'))).toBe('known failure')
    expect(readableApiError(new Error('native failure'))).toBe('native failure')
    expect(readableApiError(404)).toBe('404')
  })
})