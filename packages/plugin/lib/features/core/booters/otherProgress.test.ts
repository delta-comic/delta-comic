import { describe, expect, it, vi } from 'vite-plus/test'

import type { OtherProgress } from '@/plugin'

import { runOtherProgress } from './50_otherProcess'

const deferredProgress = (name: string, async = false) => {
  const deferred = Promise.withResolvers<void>()
  const progress: OtherProgress.Config = { name, async, call: () => deferred.promise }
  return { deferred, progress }
}

describe('otherProgress scheduler', () => {
  it('runs adjacent async steps together and uses sync steps as barriers', async () => {
    const events: string[] = []
    const first = deferredProgress('A', true)
    const second = deferredProgress('B', true)
    const trailing = deferredProgress('D', true)
    const sync: OtherProgress.Config = {
      name: 'C',
      async call() {
        events.push('C')
      },
    }

    const operation = runOtherProgress([first.progress, second.progress, sync, trailing.progress], {
      setMeta: meta => events.push(meta.name),
    })

    expect(events).toEqual(['A', 'B'])
    second.deferred.resolve()
    await Promise.resolve()
    expect(events).toEqual(['A', 'B'])

    first.deferred.resolve()
    await operation
    expect(events).toEqual(['A', 'B', 'C', 'C', 'D'])

    trailing.deferred.resolve()
  })

  it('reports trailing background failures without rejecting plugin loading', async () => {
    const onBackgroundError = vi.fn()
    const background: OtherProgress.Config = {
      name: 'background',
      async: true,
      call: async () => await Promise.reject(new Error('background failed')),
    }

    await expect(
      runOtherProgress([background], { setMeta: () => {}, onBackgroundError }),
    ).resolves.toBeUndefined()
    await vi.waitFor(() => expect(onBackgroundError).toHaveBeenCalledOnce())
  })
})