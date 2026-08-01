import { describe, expect, it } from 'vitest'

import { ActivationPipeline, defineCapability } from '../../../lib/kernel/capability'
import { PluginScope } from '../../../lib/kernel/scope'

describe('ActivationPipeline', () => {
  it('runs explicitly ordered capabilities and skips absent models', async () => {
    const calls: string[] = []
    const pipeline = new ActivationPipeline([
      defineCapability({
        id: 'model',
        select: plugin => plugin.model,
        activate: () => {
          calls.push('model')
        },
      }),
      defineCapability({
        id: 'hooks',
        select: plugin => plugin.hooks,
        activate: () => {
          calls.push('hooks')
        },
      }),
    ])
    const scope = new PluginScope('example')

    const activated = await pipeline.activate(
      { i18nName: 'example', model: {}, name: 'example' },
      { owner: 'example', report() {}, scope, signal: scope.signal },
    )

    expect(activated).toEqual(['model'])
    expect(calls).toEqual(['model'])
  })

  it('rejects duplicate capability ids at composition time', () => {
    const capability = defineCapability({ id: 'duplicate', select: () => true, activate() {} })
    expect(() => new ActivationPipeline([capability, capability])).toThrow(
      'duplicate capability "duplicate"',
    )
  })
})