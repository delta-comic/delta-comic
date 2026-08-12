import { describe, expect, it } from 'vite-plus/test'

import { pluginInstallProgressPercentage } from '../../../../src/features/pluginInstall/progress'

describe('pluginInstallProgressPercentage', () => {
  it.each([
    ['resolve', 0, 0],
    ['resolve', 50, 35],
    ['resolve', 100, 70],
    ['decode', 0, 70],
    ['decode', 50, 80],
    ['decode', 100, 90],
    ['persist', 0, 90],
    ['persist', 50, 95],
    ['persist', 100, 100],
  ] as const)('maps %s progress %s to %s', (phase, progress, expected) => {
    expect(pluginInstallProgressPercentage({ phase, progress })).toBe(expected)
  })

  it('clamps phase progress before weighting it', () => {
    expect(pluginInstallProgressPercentage({ phase: 'resolve', progress: 150 })).toBe(70)
    expect(pluginInstallProgressPercentage({ phase: 'persist', progress: -50 })).toBe(90)
  })
})