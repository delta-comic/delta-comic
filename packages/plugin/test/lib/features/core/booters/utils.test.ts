import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { testApi, testResourceApi } from '../../../../../lib/features/core/booters/utils'

afterEach(() => {
  vi.useRealTimers()
})

describe('plugin endpoint probes', () => {
  it('rejects configurations without any fork candidates', async () => {
    await expect(testApi({ forks: async () => [], test: vi.fn() } as never)).rejects.toThrow(
      '[plugin test] no fork found',
    )
  })

  it('chooses the fastest successful API and exposes the shared abort signal', async () => {
    vi.useFakeTimers()
    const signals: AbortSignal[] = []
    const test = vi.fn(async (url: string, signal: AbortSignal) => {
      signals.push(signal)
      await new Promise(resolve => setTimeout(resolve, url.includes('fast') ? 10 : 30))
    })

    const result = testApi({
      forks: async () => ['https://slow.test', 'https://fast.test'],
      test,
    } as never)
    await vi.advanceTimersByTimeAsync(30)

    await expect(result).resolves.toEqual(['https://fast.test', 10])
    expect(test).toHaveBeenCalledTimes(2)
    expect(signals[0]).toBe(signals[1])
    expect(signals[0].aborted).toBe(true)
  })

  it('ignores failed forks and returns false when none are reachable', async () => {
    const test = vi.fn(async () => {
      throw new Error('offline')
    })

    await expect(
      testResourceApi({ test, type: 'image', urls: ['https://a.test', 'https://b.test'] } as never),
    ).resolves.toEqual(['', false])
  })

  it('aborts a probe after the ten-second timeout', async () => {
    vi.useFakeTimers()
    const test = vi.fn(
      async (_url: string, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        }),
    )

    const result = testResourceApi({ test, type: 'image', urls: ['https://slow.test'] } as never)
    await vi.advanceTimersByTimeAsync(10_000)

    await expect(result).resolves.toEqual(['', false])
    expect(test).toHaveBeenCalledOnce()
  })
})