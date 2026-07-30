import { afterEach, describe, expect, it } from 'vite-plus/test'

import {
  createDependencyRegistry,
  declareDepType,
  defaultDependencyRegistry,
  pluginExposes,
  provide,
  require,
} from '../../lib/depends'

describe('DependencyRegistry', () => {
  afterEach(() => {
    pluginExposes.clear()
  })

  it('declares stable dependency keys and resolves provided exposes', () => {
    const reader = declareDepType<{ open: () => string }>('reader')
    const expose = { open: () => 'ok' }

    provide(reader, expose)

    expect(Symbol.keyFor(reader)).toBe('expose:reader')
    expect(require(reader)).toBe(expose)
    expect(defaultDependencyRegistry.has(reader)).toBe(true)
  })

  it('keeps explicitly created registries isolated from the default registry', () => {
    const reader = declareDepType<{ name: string }>('reader')
    const registry = createDependencyRegistry()

    registry.provide(reader, { name: 'local' })

    expect(registry.require(reader)).toEqual({ name: 'local' })
    expect(defaultDependencyRegistry.has(reader)).toBe(false)
  })

  it('throws a descriptive error when an expose is missing', () => {
    const missing = declareDepType('missing')

    expect(() => require(missing)).toThrow('not found plugin expose "expose:missing"')
  })
})