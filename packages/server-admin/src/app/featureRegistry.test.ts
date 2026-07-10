import { describe, expect, it } from 'vitest'

import { adminFeatures, featureNavigation, featureRoutes } from './featureRegistry'

describe('admin feature registry', () => {
  it('discovers feature modules and keeps navigation ordering stable', () => {
    expect(adminFeatures.map(feature => feature.key)).toEqual([
      'overview',
      'plugins',
      'observability',
      'modules',
      'openapi',
      'settings',
    ])
    expect(featureNavigation.map(item => item.path)).toEqual([
      '/',
      '/plugins',
      '/observability',
      '/modules',
      '/openapi',
      '/settings',
    ])
    expect(featureRoutes.map(route => route.path)).toContain('/plugins')
  })
})