import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { nextTick } from 'vue'

import '../test/setup'

type StorePayload = { key: string; namespace: string; value: string }

const nativeStoreKey = ({ key, namespace }: Omit<StorePayload, 'value'>) => `${namespace}:${key}`

const flushNativeStore = async () => {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
}

const waitForExpect = async (assertion: () => void) => {
  let lastError: unknown
  for (let index = 0; index < 20; index++) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
      await flushNativeStore()
    }
  }
  throw lastError
}

const mockSqliteStore = async (
  initialValues: Array<[string, string]> = [],
  options: { loadError?: Error; saveError?: Error } = {},
) => {
  const values = new Map(initialValues)
  const calls: Array<{ command: string; payload: Partial<StorePayload> }> = []

  vi.doMock('../index', () => ({
    db: {
      replaceInto: (table: string) => {
        expect(table).toBe('nativeStore')
        return {
          values: (payload: StorePayload) => ({
            execute: async () => {
              if (options.saveError) throw options.saveError
              calls.push({ command: 'replaceInto', payload })
              values.set(nativeStoreKey(payload), payload.value)
            },
          }),
        }
      },
      selectFrom: (table: string) => {
        expect(table).toBe('nativeStore')
        const payload: Partial<StorePayload> = {}
        return {
          select: () => ({
            where(column: 'namespace' | 'key', _operator: '=', value: string) {
              payload[column] = value
              return this
            },
            async executeTakeFirst() {
              if (options.loadError) throw options.loadError
              calls.push({ command: 'selectFrom', payload })
              const value = values.get(nativeStoreKey(payload as Omit<StorePayload, 'value'>))
              return value === undefined ? undefined : { value }
            },
          }),
        }
      },
    },
  }))

  const { useNativeStore } = await import('./index')
  return { calls, useNativeStore, values }
}

afterEach(() => {
  vi.useRealTimers()
  globalThis.localStorage.clear()
})

describe('useNativeStore', () => {
  it('hydrates state from sqlite storage and persists deep changes', async () => {
    vi.useFakeTimers()
    const { calls, useNativeStore, values } = await mockSqliteStore([
      ['settings:theme', JSON.stringify({ mode: 'dark' })],
    ])

    const state = useNativeStore('settings', 'theme', { mode: 'light' })

    await flushNativeStore()
    await waitForExpect(() => expect(state.value).toEqual({ mode: 'dark' }))

    state.value.mode = 'blue'
    await nextTick()
    await vi.advanceTimersByTimeAsync(100)

    expect(JSON.parse(values.get('settings:theme') ?? '{}')).toEqual({ mode: 'blue' })
    expect(calls.map(({ command }) => command)).toEqual(['selectFrom', 'replaceInto'])
  })

  it('uses legacy localStorage when sqlite storage is missing and migrates the value', async () => {
    vi.useFakeTimers()
    globalThis.localStorage.setItem('settings:theme', JSON.stringify({ mode: 'legacy' }))
    const { calls, useNativeStore, values } = await mockSqliteStore()

    const state = useNativeStore('settings', 'theme', { mode: 'light' })

    await flushNativeStore()
    await waitForExpect(() => expect(state.value).toEqual({ mode: 'legacy' }))
    await vi.advanceTimersByTimeAsync(100)

    expect(state.value).toEqual({ mode: 'legacy' })
    expect(JSON.parse(values.get('settings:theme') ?? '{}')).toEqual({ mode: 'legacy' })
    expect(calls.map(({ command }) => command)).toEqual(['selectFrom', 'replaceInto'])
  })

  it('falls back to a cloned default value when stored JSON is invalid', async () => {
    const defaultValue = { mode: 'light' }
    const { Logger } = await import('@delta-comic/logger')
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
    const { useNativeStore } = await mockSqliteStore([['settings:theme', '{bad json']])

    const state = useNativeStore('settings', 'theme', defaultValue)

    await flushNativeStore()
    await waitForExpect(() =>
      expect(warn).toHaveBeenCalledWith(
        'failed to parse native store value',
        expect.any(SyntaxError),
      ),
    )

    expect(state.value).toEqual(defaultValue)
    expect(state.value).not.toBe(defaultValue)
  })

  it('recovers from sqlite load failures without exposing a mutable default object', async () => {
    const defaultValue = { mode: 'light' }
    const { Logger } = await import('@delta-comic/logger')
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const { useNativeStore } = await mockSqliteStore([], {
      loadError: new Error('database unavailable'),
    })

    const state = useNativeStore('settings', 'theme', defaultValue)
    await flushNativeStore()
    await waitForExpect(() =>
      expect(warn).toHaveBeenCalledWith(
        'failed to load native store value',
        { key: 'theme', namespace: 'settings' },
        expect.objectContaining({ message: 'database unavailable' }),
      ),
    )

    expect(state.value).toEqual(defaultValue)
    expect(state.value).not.toBe(defaultValue)
  })

  it('contains asynchronous persistence failures after state changes', async () => {
    vi.useFakeTimers()
    const { Logger } = await import('@delta-comic/logger')
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const { useNativeStore } = await mockSqliteStore(
      [['settings:theme', JSON.stringify({ mode: 'dark' })]],
      { saveError: new Error('disk full') },
    )
    const state = useNativeStore('settings', 'theme', { mode: 'light' })
    await flushNativeStore()
    await waitForExpect(() => expect(state.value).toEqual({ mode: 'dark' }))

    state.value.mode = 'blue'
    await nextTick()
    await vi.advanceTimersByTimeAsync(100)

    expect(warn).toHaveBeenCalledWith(
      'failed to persist native store value',
      { key: 'theme', namespace: 'settings' },
      expect.objectContaining({ message: 'disk full' }),
    )
  })
})