import { Logger } from '@delta-comic/logger'
import { describe, expect, it, vi } from 'vitest'

import { bindRuntime, getRuntime, readNumberVar, type AppRuntime } from '../env'

import {
  bytesToBase64Url,
  bytesToHex,
  constantTimeEqual,
  hashJson,
  hmacSha256Hex,
  randomBytes,
  randomToken,
  sha256Hex,
} from './crypto'
import { AppError, asPublicError, isAppError } from './errors'
import { createId, isUuid } from './ids'
import { parseJson, stableStringify } from './json'
import { errorResponse, fail, ok } from './response'

describe('server environment helpers', () => {
  it('binds runtime state by request identity and rejects unbound requests', () => {
    const request = new Request('https://delta.example')
    const runtime = {
      ctx: {} as ExecutionContext,
      env: { DB: {} as D1Database } as AppRuntime['env'],
    }
    bindRuntime(request, runtime)

    expect(getRuntime(request)).toBe(runtime)
    expect(() => getRuntime(new Request('https://delta.example'))).toThrow(
      'runtime is not bound to this request',
    )
  })

  it('accepts positive numeric vars and falls back for absent or unsafe values', () => {
    expect(readNumberVar('12.5', 3)).toBe(12.5)
    expect(readNumberVar(undefined, 3)).toBe(3)
    expect(readNumberVar('', 3)).toBe(3)
    expect(readNumberVar('NaN', 3)).toBe(3)
    expect(readNumberVar('0', 3)).toBe(3)
    expect(readNumberVar('-1', 3)).toBe(3)
  })
})

describe('stable JSON helpers', () => {
  it('sorts object keys recursively and normalizes unsupported JSON values', () => {
    expect(
      stableStringify({
        z: undefined,
        b: [Number.POSITIVE_INFINITY, true, () => undefined],
        a: { d: 2, c: 'value' },
      }),
    ).toBe('{"a":{"c":"value","d":2},"b":[null,true,null]}')
    expect(stableStringify(Symbol('unsupported'))).toBe('null')
  })

  it('parses present JSON and treats missing persisted values as absent', () => {
    expect(parseJson<{ value: number }>('{"value":1}')).toEqual({ value: 1 })
    expect(parseJson(null)).toBeUndefined()
    expect(parseJson(undefined)).toBeUndefined()
    expect(() => parseJson('{broken')).toThrow()
  })
})

describe('crypto and identity helpers', () => {
  it('encodes bytes and produces deterministic digests', async () => {
    expect(bytesToHex(new Uint8Array([0, 15, 255]))).toBe('000fff')
    expect(bytesToBase64Url(new Uint8Array([251, 255]))).toBe('-_8')
    await expect(sha256Hex('delta')).resolves.toMatch(/^[a-f0-9]{64}$/)
    await expect(hashJson({ b: 2, a: 1 })).resolves.toBe(await hashJson({ a: 1, b: 2 }))
    await expect(hmacSha256Hex('secret', 'delta')).resolves.toMatch(/^[a-f0-9]{64}$/)
  })

  it('generates requested entropy and compares secrets without prefix acceptance', () => {
    expect(randomBytes(7)).toHaveLength(7)
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(constantTimeEqual('same', 'same')).toBe(true)
    expect(constantTimeEqual('same', 'diff')).toBe(false)
    expect(constantTimeEqual('short', 'longer')).toBe(false)

    expect(createId('usr')).toMatch(/^usr_[0-9a-f-]{36}$/)
    expect(isUuid('00000000-0000-4000-8000-000000000000')).toBe(true)
    expect(isUuid('not-a-uuid')).toBe(false)
  })
})

describe('public error and response helpers', () => {
  it('keeps explicit application errors and hides unhandled exception details', () => {
    const appError = new AppError('CONFLICT', 'already exists', 409, { id: 1 })
    expect(isAppError(appError)).toBe(true)
    expect(isAppError(new Error('other'))).toBe(false)
    expect(asPublicError(appError)).toBe(appError)

    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
    expect(asPublicError(new Error('database password leaked'))).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'internal server error',
      status: 500,
    })
    expect(log).toHaveBeenCalledOnce()
    expect(log).toHaveBeenCalledWith('unhandled error', expect.any(Error))
  })

  it('builds success/failure payloads and maps framework errors to HTTP responses', async () => {
    expect(ok({ id: 1 })).toEqual({ data: { id: 1 }, ok: true })
    expect(fail(new AppError('BAD', 'bad input', 400))).toEqual({
      error: { code: 'BAD', message: 'bad input' },
      ok: false,
    })
    expect(fail(new AppError('BAD', 'bad input', 400, { field: 'name' }))).toMatchObject({
      error: { details: { field: 'name' } },
    })

    const notFound = errorResponse(new Error('ignored'), 'NOT_FOUND')
    expect(notFound.status).toBe(404)
    await expect(notFound.json()).resolves.toMatchObject({ error: { code: 'ROUTE_NOT_FOUND' } })

    const validation = errorResponse({ code: 'VALIDATION', message: undefined })
    expect(validation.status).toBe(400)
    await expect(validation.json()).resolves.toMatchObject({
      error: { code: 'REQUEST_VALIDATION_FAILED', message: 'request validation failed' },
    })

    const frameworkValidation = errorResponse(
      { code: 'OTHER', message: 'invalid body' },
      'VALIDATION',
    )
    expect(frameworkValidation.status).toBe(500)
  })
})