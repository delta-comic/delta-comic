import { mockIPC } from '@tauri-apps/api/mocks'
import { describe, expect, it } from 'vite-plus/test'

import { CORSFetch, GLOBAL_INSTANCE_KEY } from './index'

interface IpcCall {
  cmd: string
  payload?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function recordIPC() {
  const calls: IpcCall[] = []
  mockIPC((cmd, payload) => {
    calls.push({ cmd, payload })
  })
  return calls
}

describe('CORSFetch', () => {
  it('prepares the requester and installs the global adapter for the default instance', async () => {
    const calls = recordIPC()
    const nativeFetch = window.fetch
    const nativeXMLHttpRequest = window.XMLHttpRequest

    const cors = await CORSFetch.init({ request: { userAgent: 'vitest-agent' } })

    expect(cors.config.request.instanceKey).toBe(GLOBAL_INSTANCE_KEY)
    expect(window.CORSFetch).toBe(cors)
    expect(window.fetch).not.toBe(nativeFetch)
    expect(window.fetchNative).not.toBe(nativeFetch)
    expect(window.fetchNative).toBeTypeOf('function')
    expect(window.XMLHttpRequestNative).toBe(nativeXMLHttpRequest)
    expect(window.XMLHttpRequest).toBe(cors.XHR)

    const clientCall = calls.find(
      call =>
        call.cmd === 'TauRPC__http.prepare_requester' &&
        isRecord(call.payload) &&
        'client' in call.payload,
    )

    expect(clientCall?.payload).toMatchObject({
      client: {
        instanceKey: GLOBAL_INSTANCE_KEY,
        userAgent: 'vitest-agent',
        danger: { acceptInvalidCerts: false, acceptInvalidHostnames: false },
      },
    })
  })

  it('serializes cookie parts before invoking the set_cookie command', async () => {
    const calls = recordIPC()
    const cors = await CORSFetch.init({
      request: { instanceKey: 'cookies', userAgent: 'vitest-agent' },
    })

    await cors.setCookieByParts('https://example.com/path', 'session', 'abc', {
      domain: 'example.com',
      expires: new Date(Date.UTC(2030, 0, 2, 3, 4, 5)),
      httpOnly: true,
      maxAge: 3600,
      path: '/',
      sameSite: 'None',
      secure: true,
    })

    const cookieCall = calls.find(call => call.cmd === 'TauRPC__http.set_cookie')

    expect(cookieCall?.payload).toEqual({
      config: {
        content:
          'session=abc; Domain=example.com; Path=/; Expires=Wed, 02 Jan 2030 03:04:05 GMT; Max-Age=3600; Secure; HttpOnly; SameSite=None',
        instanceKey: 'cookies',
        url: 'https://example.com/path',
      },
    })
  })
})
