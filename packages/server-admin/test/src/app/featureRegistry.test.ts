import { describe, expect, it } from 'vitest'

import { adminFeatures, featureNavigation, featureRoutes } from '../../../src/app/featureRegistry'

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

  it('lazy-loads every registered feature page', async () => {
    for (const route of featureRoutes) {
      expect(route.component).toBeTypeOf('function')
      const module = await (route.component as () => Promise<{ default: unknown }>)()
      expect(module.default).toBeDefined()
    }
  }, 15_000)
})