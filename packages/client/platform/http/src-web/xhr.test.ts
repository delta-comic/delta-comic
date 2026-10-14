import { describe, expect, it, vi } from 'vite-plus/test'

import { createCORSXMLHttpRequestConstructor } from './xhr'
import type { CORSFetchFunction } from './xhr'

function waitForXHR(xhr: XMLHttpRequest, eventName = 'loadend'): Promise<Event> {
  return new Promise(resolve => {
    xhr.addEventListener(eventName, resolve, { once: true })
  })
}

function toBytes(value: string) {
  return new TextEncoder().encode(value)
}

function expectFirstCall(calls: Parameters<CORSFetchFunction>[]) {
  const call = calls[0]
  if (!call) throw new Error('expected corsFetch to be called')
  return call
}

function expectRequestInit(init: Parameters<CORSFetchFunction>[1]) {
  if (!init) throw new Error('expected request init')
  return init
}

describe('createCORSXMLHttpRequestConstructor', () => {
  it('sends requests through the provided fetch function and exposes text responses', async () => {
    const calls: Parameters<CORSFetchFunction>[] = []
    const corsFetch = vi.fn(async (...args: Parameters<CORSFetchFunction>) => {
      calls.push(args)
      return new Response('hello', {
        headers: { 'content-length': '5', 'content-type': 'text/plain', 'x-response': 'ok' },
        status: 202,
        statusText: 'Accepted',
      })
    })
    const XHR = createCORSXMLHttpRequestConstructor(corsFetch, true)
    const xhr = new XHR()
    const readyStates: number[] = []
    const progress: Array<{ loaded: number; total: number }> = []

    xhr.onreadystatechange = () => readyStates.push(xhr.readyState)
    xhr.onprogress = event => progress.push({ loaded: event.loaded, total: event.total })

    xhr.open('POST', 'https://user:pass@example.test/api')
    xhr.setRequestHeader('x-test', 'one')
    xhr.withCredentials = true

    const loadend = waitForXHR(xhr)
    xhr.send('payload')
    await loadend

    expect(corsFetch).toHaveBeenCalledOnce()
    const [url, maybeInit, force] = expectFirstCall(calls)
    const init = expectRequestInit(maybeInit)
    const headers = init.headers as Headers

    expect(url).toBe('https://example.test/api')
    expect(force).toBe(true)
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(init.body).toBe('payload')
    expect(headers).toBeInstanceOf(Headers)
    expect(headers.get('authorization')).toBe('Basic dXNlcjpwYXNz')
    expect(headers.get('x-test')).toBe('one')

    expect(xhr.readyState).toBe(xhr.DONE)
    expect(xhr.status).toBe(202)
    expect(xhr.statusText).toBe('Accepted')
    expect(xhr.responseURL).toBe('')
    expect(xhr.responseText).toBe('hello')
    expect(xhr.response).toBe('hello')
    expect(xhr.getResponseHeader('content-type')).toBe('text/plain')
    expect(xhr.getAllResponseHeaders()).toContain('x-response: ok')
    expect(readyStates).toEqual([xhr.OPENED, xhr.HEADERS_RECEIVED, xhr.LOADING, xhr.DONE])
    expect(progress).toContainEqual({ loaded: 5, total: 5 })
  })

  it('parses json responses and omits request bodies for GET requests', async () => {
    const calls: Parameters<CORSFetchFunction>[] = []
    const corsFetch = vi.fn(async (...args: Parameters<CORSFetchFunction>) => {
      calls.push(args)
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      })
    })
    const XHR = createCORSXMLHttpRequestConstructor(corsFetch)
    const xhr = new XHR()
    xhr.responseType = 'json'

    xhr.open('GET', '/relative')
    const loadend = waitForXHR(xhr)
    xhr.send('ignored')
    await loadend

    const [url, maybeInit, force] = expectFirstCall(calls)
    const init = expectRequestInit(maybeInit)
    expect(url).toBe('http://localhost/relative')
    expect(force).toBe(false)
    expect(init.body).toBeNull()
    expect(xhr.response).toEqual({ ok: true })
    expect(() => xhr.responseText).toThrowError(/responseText is only available/)
  })

  it('returns arraybuffer responses for binary responseType', async () => {
    const corsFetch = vi.fn(async () => {
      return new Response(toBytes('abc'), {
        headers: { 'content-type': 'application/octet-stream' },
      })
    })
    const XHR = createCORSXMLHttpRequestConstructor(corsFetch)
    const xhr = new XHR()
    xhr.responseType = 'arraybuffer'

    xhr.open('GET', 'https://example.test/file')
    const loadend = waitForXHR(xhr)
    xhr.send()
    await loadend

    expect(xhr.response).toBeInstanceOf(ArrayBuffer)
    expect(Array.from(new Uint8Array(xhr.response as ArrayBuffer))).toEqual(
      Array.from(toBytes('abc')),
    )
  })

  it('moves to DONE and emits error when the fetch function rejects', async () => {
    const corsFetch = vi.fn(async () => {
      throw new Error('network failed')
    })
    const XHR = createCORSXMLHttpRequestConstructor(corsFetch)
    const xhr = new XHR()
    const onError = vi.fn()

    xhr.onerror = onError
    xhr.open('GET', 'https://example.test/error')
    const loadend = waitForXHR(xhr)
    xhr.send()
    await loadend

    expect(onError).toHaveBeenCalledOnce()
    expect(xhr.readyState).toBe(xhr.DONE)
    expect(xhr.status).toBe(0)
    expect(xhr.responseText).toBe('')
  })

  it('throws for invalid request states and unsupported modes', () => {
    const XHR = createCORSXMLHttpRequestConstructor(vi.fn())
    const xhr = new XHR()

    expect(() => xhr.send()).toThrowError(/opened before send/)
    expect(() => xhr.open('TRACE', 'https://example.test')).toThrowError(/TRACE is not allowed/)

    xhr.open('GET', 'https://example.test', false)
    expect(() => xhr.send()).toThrowError(/Synchronous XMLHttpRequest is not supported/)
  })
})