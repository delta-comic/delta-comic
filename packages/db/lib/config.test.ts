import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  replaceExecute: vi.fn(async () => undefined),
  replaceValues: vi.fn(),
  selectExecute: vi.fn(async () => undefined as unknown),
}))

vi.mock('.', () => ({
  db: {
    replaceInto: vi.fn(() => ({
      values: (value: unknown) => {
        mocks.replaceValues(value)
        return { execute: mocks.replaceExecute }
      },
    })),
    selectFrom: vi.fn(() => ({
      select: vi.fn(() => ({ where: vi.fn(() => ({ executeTakeFirst: mocks.selectExecute })) })),
    })),
  },
}))

import { useConfig } from './config'

const form = {
  enabled: { defaultValue: true, label: 'Enabled', type: 'boolean' },
  nested: { defaultValue: { retries: 2 }, label: 'Nested', type: 'object' },
} as never

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  mocks.selectExecute.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('database-backed config refs', () => {
  it('hydrates stored data without rewriting an unchanged form', async () => {
    mocks.selectExecute.mockResolvedValueOnce({
      data: JSON.stringify({ enabled: false, nested: { retries: 5 } }),
      form: JSON.stringify(form),
    })

    const config = useConfig('fixture', form)
    expect(config.value).toEqual({ enabled: true, nested: { retries: 2 } })
    await config.ready

    expect(config.value).toEqual({ enabled: false, nested: { retries: 5 } })
    await vi.advanceTimersByTimeAsync(100)
    expect(mocks.replaceValues).not.toHaveBeenCalled()
  })

  it('persists defaults for a new config and debounces deep changes', async () => {
    const config = useConfig('fixture', form)
    await config.ready

    await vi.advanceTimersByTimeAsync(99)
    expect(mocks.replaceValues).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(mocks.replaceValues).toHaveBeenLastCalledWith({
      belongTo: 'fixture',
      data: JSON.stringify({ enabled: true, nested: { retries: 2 } }),
      form: JSON.stringify(form),
    })

    ;(config.value as any).nested.retries = 3
    await nextTick()
    ;(config.value as any).nested.retries = 4
    await nextTick()
    await vi.advanceTimersByTimeAsync(100)

    expect(mocks.replaceValues).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: JSON.stringify({ enabled: true, nested: { retries: 4 } }) }),
    )
    expect(mocks.replaceExecute).toHaveBeenCalledTimes(2)
  })

  it('rewrites persisted data when the form schema changes', async () => {
    mocks.selectExecute.mockResolvedValueOnce({
      data: { enabled: false, nested: { retries: 1 } },
      form: JSON.stringify({ old: true }),
    })

    const config = useConfig('fixture', form)
    await config.ready
    await vi.advanceTimersByTimeAsync(100)

    expect(config.value).toEqual({ enabled: false, nested: { retries: 1 } })
    expect(mocks.replaceValues).toHaveBeenCalledOnce()
  })

  it('falls back to detached defaults for malformed stored JSON', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.selectExecute.mockResolvedValueOnce({ data: '{broken', form: JSON.stringify(form) })

    const first = useConfig('first', form)
    await first.ready
    ;(first.value as any).nested.retries = 99
    mocks.selectExecute.mockResolvedValueOnce({ data: null, form: JSON.stringify(form) })
    const second = useConfig('second', form)
    await second.ready

    expect((first.value as any).nested.retries).toBe(99)
    expect((second.value as any).nested.retries).toBe(2)
    expect(warning).toHaveBeenCalledWith(
      '[db] failed to parse config value',
      expect.any(SyntaxError),
    )
  })

  it('keeps defaults when hydration fails and reports asynchronous persistence errors', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.selectExecute.mockRejectedValueOnce(new Error('select failed'))
    const failedLoad = useConfig('failed-load', form)
    await failedLoad.ready
    expect(failedLoad.value).toEqual({ enabled: true, nested: { retries: 2 } })
    expect(warning).toHaveBeenCalledWith(
      '[db] failed to load config value',
      expect.objectContaining({ message: 'select failed' }),
    )

    mocks.replaceExecute.mockRejectedValueOnce(new Error('write failed'))
    ;(failedLoad.value as any).enabled = false
    await nextTick()
    await vi.advanceTimersByTimeAsync(100)
    expect(warning).toHaveBeenCalledWith(
      '[db] failed to persist config value',
      expect.objectContaining({ message: 'write failed' }),
    )
  })
})