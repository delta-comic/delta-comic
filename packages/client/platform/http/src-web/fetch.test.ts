import { mockIPC } from '@tauri-apps/api/mocks'
import { describe, expect, it, vi } from 'vite-plus/test'

import { createCORSFetch } from './fetch'
import type { CORSFetchConfig } from './fetch'

interface IpcCall {
  cmd: string
  payload?: unknown
}

function createConfig(config: Partial<CORSFetchConfig> = {}): CORSFetchConfig {
  return {
    exclude: config.exclude ?? [],
    include: config.include ?? [],
    request: {
      connectTimeout: null,
      danger: { acceptInvalidCerts: false, acceptInvalidHostnames: false },
      instanceKey: '',
      maxRedirections: null,
      proxy: null,
      userAgent: 'vitest-agent',
      ...config.request,
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getContentConfig(call: IpcCall) {
  if (!isRecord(call.payload) || !isRecord(call.payload.content_config)) {
    throw new TypeError('missing contentConfig payload')
  }

  return call.payload.content_config
}

describe('createCORSFetch', () => {
  it('uses the native fetch implementation for excluded URLs', async () => {
    const nativeResponse = new Response('native')
    const nativeFetch = vi.fn(async () => nativeResponse)
    window.fetchNative = nativeFetch as typeof fetch
    mockIPC(cmd => {
      throw new Error(`unexpected IPC command: ${cmd}`)
    })

    const corsFetch = createCORSFetch(() => createConfig({ exclude: ['example.com'] }))

    await expect(corsFetch('https://example.com/data')).resolves.toBe(nativeResponse)
    expect(nativeFetch).toHaveBeenCalledWith('https://example.com/data', undefined)
  })

  it('sends HTTP requests through IPC and streams the response body', async () => {
    const calls: IpcCall[] = []
    const encoder = new TextEncoder()
    const chunks = [
      { bytes: Array.from(encoder.encode('proxied')), done: false },
      { bytes: [], done: true },
    ]

    mockIPC((cmd, payload) => {
      calls.push({ cmd, payload })

      switch (cmd) {
        case 'TauRPC__http.fetch':
          return 1
        case 'TauRPC__http.fetch_send':
          return {
            headers: [['content-type', 'text/plain']],
            rid: 2,
            status: 201,
            statusText: 'Created',
            url: 'https://api.example.com/items',
          }
        case 'TauRPC__http.fetch_read_body':
          return chunks.shift()
        case 'TauRPC__http.fetch_cancel':
        case 'TauRPC__http.fetch_cancel_body':
          return undefined
        default:
          throw new Error(`unexpected IPC command: ${cmd}`)
      }
    })

    const corsFetch = createCORSFetch(() => createConfig())
    const response = await corsFetch('https://api.example.com/items', {
      body: 'hello',
      headers: { 'x-test': '1' },
      method: 'POST',
    })

    expect(response.status).toBe(201)
    expect(response.statusText).toBe('Created')
    expect(response.url).toBe('https://api.example.com/items')
    expect(response.headers.get('content-type')).toBe('text/plain')
    await expect(response.text()).resolves.toBe('proxied')

    const fetchCall = calls.find(call => call.cmd === 'TauRPC__http.fetch')
    expect(fetchCall).toBeDefined()

    const contentConfig = getContentConfig(fetchCall!)
    expect(contentConfig).toMatchObject({
      client: { instanceKey: '', userAgent: 'vitest-agent' },
      method: 'POST',
      url: 'https://api.example.com/items',
    })
    expect(contentConfig.data).toEqual(Array.from(encoder.encode('hello')))
    expect(contentConfig.headers).toContainEqual(['x-test', '1'])
    expect(calls.filter(call => call.cmd === 'TauRPC__http.fetch_read_body')).toHaveLength(2)
  })
})
