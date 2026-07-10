import { describe, expect, it } from 'vitest'

import type { ServerPluginManifest } from '../../../lib/plugin'

import { planServerPluginLoadOrder } from './plugins.plan'

const manifest = (
  id: string,
  dependencies: ServerPluginManifest['dependencies'] = [],
  version = '1.0.0',
): ServerPluginManifest => ({
  apiVersion: 1,
  author: 'Delta Comic',
  capabilities: [],
  configSchema: { properties: {} },
  dependencies,
  description: `${id} plugin`,
  id,
  name: id,
  version,
})

describe('planServerPluginLoadOrder', () => {
  it('orders dependencies before dependents in stable parallel levels', () => {
    const result = planServerPluginLoadOrder([
      manifest('feature.alpha', [{ id: 'core.base', versionRange: '^1.0.0' }]),
      manifest('feature.beta', [{ id: 'core.base' }]),
      manifest('core.base'),
    ])

    expect(result).toEqual({
      cycles: [],
      levels: [['core.base'], ['feature.alpha', 'feature.beta']],
      missing: [],
    })
  })

  it('reports missing and incompatible dependencies separately', () => {
    const result = planServerPluginLoadOrder([
      manifest('core.base', [], '1.4.0'),
      manifest('feature.alpha', [
        { id: 'core.base', versionRange: '^2.0.0' },
        { id: 'core.missing', versionRange: '^1.0.0' },
      ]),
    ])

    expect(result.missing).toEqual([
      {
        actualVersion: '1.4.0',
        dependencyId: 'core.base',
        pluginId: 'feature.alpha',
        reason: 'incompatible',
        versionRange: '^2.0.0',
      },
      {
        dependencyId: 'core.missing',
        pluginId: 'feature.alpha',
        reason: 'missing',
        versionRange: '^1.0.0',
      },
    ])
  })

  it('returns an explicit dependency cycle path', () => {
    const result = planServerPluginLoadOrder([
      manifest('cycle.alpha', [{ id: 'cycle.beta' }]),
      manifest('cycle.beta', [{ id: 'cycle.alpha' }]),
    ])

    expect(result.levels).toEqual([])
    expect(result.cycles).toEqual([['cycle.alpha', 'cycle.beta', 'cycle.alpha']])
  })
})