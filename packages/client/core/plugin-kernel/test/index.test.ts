import { describe, expect, it } from 'vitest'

import { PluginScope, planPluginDependencies } from '../lib'
import type { PluginCandidate } from '../lib'

const candidate = (id: string, dependencies: string[] = []): PluginCandidate => ({
  manifest: {
    protocolVersion: 1,
    id,
    name: id,
    version: '1.0.0',
    entry: 'index.js',
    entryType: 'plugin',
    resources: [],
    dependencies: dependencies.map(dependencyId => ({ id: dependencyId })),
  },
  origin: 'installed',
  enabled: true,
  management: {},
  load: async () => ({ factory: () => ({ name: id }) }),
})

describe('plugin kernel', () => {
  it('plans candidates with the new manifest dependency fields', () => {
    const plan = planPluginDependencies([candidate('consumer', ['core']), candidate('core')])
    expect(plan.missing).toEqual([])
    expect(plan.levels.map(level => level.map(item => item.manifest.id))).toEqual([
      ['core'],
      ['consumer'],
    ])
  })

  it('disposes scope handlers in reverse order', async () => {
    const order: string[] = []
    const scope = new PluginScope('example')
    scope.defer(() => {
      order.push('first')
    })
    scope.defer(() => {
      order.push('second')
    })
    await scope.dispose()
    expect(order).toEqual(['second', 'first'])
  })

  it('contains failed plugin calls and reports scope state', async () => {
    const errors: string[] = []
    const scope = new PluginScope('safe', {
      diagnostics: { record: (_level, message) => errors.push(message) },
    })
    await expect(
      scope.safeCall(() => {
        throw new Error('boom')
      }, 'load'),
    ).resolves.toBeUndefined()
    expect(scope.state).toBe('failed')
    expect(errors).toEqual(['plugin scope call failed'])
    await scope.dispose()
    expect(scope.state).toBe('disposed')
  })
})