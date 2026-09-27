import { describe, expect, it, vi } from 'vitest'

import { PluginScope } from '../../../lib/kernel/scope'

describe('PluginScope', () => {
  it('aborts and disposes resources in reverse order', async () => {
    const calls: string[] = []
    const scope = new PluginScope('example')
    scope.defer(() => {
      calls.push('first')
    })
    scope.defer(async () => {
      await Promise.resolve()
      calls.push('second')
    })

    await scope.dispose('unload')

    expect(scope.signal.aborted).toBe(true)
    expect(scope.signal.reason).toBe('unload')
    expect(calls).toEqual(['second', 'first'])
  })

  it('is idempotent and aggregates cleanup failures', async () => {
    const disposer = vi.fn(() => {
      throw new Error('cleanup failed')
    })
    const scope = new PluginScope('example')
    scope.defer(disposer)

    const first = scope.dispose()
    const second = scope.dispose()

    expect(first).toBe(second)
    await expect(first).rejects.toThrow('failed to dispose plugin scope "example"')
    expect(disposer).toHaveBeenCalledOnce()
  })
})