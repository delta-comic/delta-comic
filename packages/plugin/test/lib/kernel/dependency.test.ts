import type { PluginManifest } from '@delta-comic/model'
import { describe, expect, it } from 'vitest'

import type { PluginCandidate } from '../../../lib/kernel'
import { planPluginDependencies } from '../../../lib/kernel'

const candidate = (id: string, require: string[] = []): PluginCandidate => ({
  enabled: true,
  load: async () => ({ factory: () => ({ name: id }) }),
  management: { canDisable: true, canUninstall: true, canUpdate: true },
  manifest: {
    apiVersion: 1,
    author: 'test',
    description: 'test',
    name: { display: id, id },
    require: require.map(dependency => ({ id: dependency })),
    version: { plugin: '1.0.0', supportCore: '*' },
  } satisfies PluginManifest,
  origin: 'installed',
})

describe('plugin dependency planning', () => {
  it('plans built-in and installed candidates through the same graph', () => {
    const core = { ...candidate('core'), origin: 'builtin' as const }
    const reader = candidate('reader', ['core'])

    const plan = planPluginDependencies([reader, core])

    expect(plan.levels.map(level => level.map(item => item.manifest.name.id))).toEqual([
      ['core'],
      ['reader'],
    ])
    expect(plan.missing).toEqual([])
    expect(plan.cycles).toEqual([])
  })

  it('reports missing dependencies and canonical cycles', () => {
    const plan = planPluginDependencies([
      candidate('a', ['b']),
      candidate('b', ['a']),
      candidate('c', ['missing']),
    ])

    expect(plan.missing).toEqual([{ dependency: 'missing', plugin: 'c' }])
    expect(plan.cycles).toEqual([['a', 'b', 'a']])
  })
})