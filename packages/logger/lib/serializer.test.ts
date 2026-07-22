import { describe, expect, it } from 'vite-plus/test'

import { LogSerializer, serializeLogArguments } from './serializer'

describe('LogSerializer', () => {
  it('serializes errors with causes and custom fields', () => {
    const cause = new TypeError('invalid input')
    const error = Object.assign(new Error('request failed', { cause }), { status: 503 })

    expect(new LogSerializer().serialize(error)).toMatchObject({
      cause: { message: 'invalid input', name: 'TypeError' },
      message: 'request failed',
      name: 'Error',
      status: 503,
    })
  })

  it('handles circular references, unusual primitives, maps, and sets', () => {
    const value: Record<string, unknown> = {
      bigint: 42n,
      map: new Map([['answer', 42]]),
      nan: Number.NaN,
      set: new Set(['a']),
      undefined,
    }
    value.self = value

    expect(new LogSerializer().serialize(value)).toEqual({
      bigint: '42n',
      map: { $type: 'Map', entries: [['answer', 42]] },
      nan: '[NaN]',
      self: '[Circular $]',
      set: { $type: 'Set', values: ['a'] },
      undefined: '[undefined]',
    })
  })

  it('preserves strings and safely renders structured arguments', () => {
    expect(serializeLogArguments(['loaded', { count: 2 }, false])).toBe('loaded {"count":2} false')
  })

  it('contains throwing property access instead of failing logging', () => {
    const value = Object.create(null) as Record<string, unknown>
    Object.defineProperty(value, 'broken', {
      enumerable: true,
      get: () => {
        throw new Error('no access')
      },
    })

    expect(new LogSerializer().serialize(value)).toEqual({
      broken: '[Thrown while serializing: no access]',
    })
  })
})