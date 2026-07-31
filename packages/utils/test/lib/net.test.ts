import { describe, expect, it, vi } from 'vite-plus/test'

import { ReuseableAbortController } from '../../lib/net'

describe('ReuseableAbortController', () => {
  it('aborts the current signal and replaces it with a fresh signal', () => {
    const controller = new ReuseableAbortController()
    const firstSignal = controller.signal

    controller.abort('reset')

    expect(firstSignal.aborted).toBe(true)
    expect(firstSignal.reason).toBe('reset')
    expect(controller.signal).not.toBe(firstSignal)
    expect(controller.signal.aborted).toBe(false)
  })

  it('notifies repeat and one-shot abort listeners', async () => {
    const controller = new ReuseableAbortController()
    const repeat = vi.fn()
    const once = vi.fn()

    const off = controller.onAbort(repeat)
    controller.onAbortOnce(once)

    controller.abort()
    await Promise.resolve()
    controller.abort()

    expect(repeat).toHaveBeenCalledTimes(2)
    expect(once).toHaveBeenCalledTimes(1)

    off()
    controller.abort()

    expect(repeat).toHaveBeenCalledTimes(2)
  })
})