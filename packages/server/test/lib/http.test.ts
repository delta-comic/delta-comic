import { describe, expect, it, vi } from 'vitest'

import { CloudConfigurationError } from '../../lib/errors'
import { CloudHttpClient, isCloudApiError } from '../../lib/http'

describe('CloudHttpClient', () => {
  it('normalizes base urls and paths while forwarding auth, query, and custom headers', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input)
      expect(request.url).toBe('https://cloud.example/api/sync/pull?sinceSeq=4')
      expect(request.method).toBe('GET')
      expect(request.headers.get('authorization')).toBe('Bearer access-token')
      expect(request.headers.get('x-client')).toBe('delta')
      return Response.json({ data: { checkpoint: 4 }, ok: true })
    })
    const http = new CloudHttpClient({
      baseUrl: ' https://cloud.example/api/// ',
      fetcher,
      getAccessToken: async () => 'access-token',
    })

    await expect(
      http.get('/sync/pull', { headers: { 'x-client': 'delta' }, searchParams: { sinceSeq: 4 } }),
    ).resolves.toEqual({ checkpoint: 4 })
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('does not request an access token for public posts', async () => {
    const getAccessToken = vi.fn(async () => 'secret')
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input)
      expect(request.url).toBe('https://cloud.example/api/auth/login')
      expect(request.headers.has('authorization')).toBe(false)
      await expect(request.json()).resolves.toEqual({ loginName: 'alice' })
      return Response.json({ data: { token: 'ok' }, ok: true })
    })
    const http = new CloudHttpClient({ baseUrl: 'https://cloud.example', fetcher, getAccessToken })

    await expect(http.post('auth/login', { loginName: 'alice' }, { auth: false })).resolves.toEqual(
      { token: 'ok' },
    )
    expect(getAccessToken).not.toHaveBeenCalled()
  })

  it('rejects empty and malformed server urls before sending requests', async () => {
    const fetcher = vi.fn(async () => Response.json({ data: {}, ok: true }))
    expect(() => new CloudHttpClient({ baseUrl: ' ', fetcher })).toThrow(CloudConfigurationError)
    expect(() => new CloudHttpClient({ baseUrl: 'not a url', fetcher })).toThrow(
      CloudConfigurationError,
    )
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('maps non-API HTTP errors and successful malformed JSON into stable client errors', async () => {
    const failed = new CloudHttpClient({
      baseUrl: 'https://cloud.example',
      fetcher: async () => new Response('upstream failed', { status: 502 }),
    })
    await expect(failed.get('health')).rejects.toMatchObject({
      code: 'CLOUD_HTTP_ERROR',
      status: 502,
    })

    const malformed = new CloudHttpClient({
      baseUrl: 'https://cloud.example',
      fetcher: async () => new Response('not json', { status: 200 }),
    })
    await expect(malformed.get('health')).rejects.toMatchObject({ code: 'CLOUD_REQUEST_FAILED' })
  })

  it('preserves structured API details and exposes a reliable error guard', async () => {
    const http = new CloudHttpClient({
      baseUrl: 'https://cloud.example',
      fetcher: async () =>
        Response.json(
          {
            error: { code: 'SYNC_CONFLICT', details: { entityId: 'core' }, message: 'conflict' },
            ok: false,
          },
          { status: 409 },
        ),
    })

    const error = await http.get('sync/pull').catch(value => value as unknown)
    expect(isCloudApiError(error)).toBe(true)
    expect(error).toMatchObject({
      code: 'SYNC_CONFLICT',
      details: { entityId: 'core' },
      status: 409,
    })
    expect(isCloudApiError(new Error('other'))).toBe(false)
  })

  it('wraps network failures without discarding their message', async () => {
    const http = new CloudHttpClient({
      baseUrl: 'https://cloud.example',
      fetcher: async () => Promise.reject(new Error('connection reset')),
    })

    await expect(http.get('health')).rejects.toMatchObject({
      code: 'CLOUD_REQUEST_FAILED',
      message: 'connection reset',
    })
  })
})