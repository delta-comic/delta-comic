import { expect, it } from 'vite-plus/test'

import { ModuleRegistry, type RequireModule } from '../../lib/modules'

it('revokes failed and replaced generations, tracks lazy reads, preserves unrelated instances', () => {
  const registry = new ModuleRegistry(new Map())
  let attempts = 0
  let lazy: RequireModule = () => ({})
  registry.register({
    package: 'a',
    externals: [],
    exports: ['.'],
    factory: () => ({ components: [], modules: { '.': {} } }),
  })
  registry.register({
    package: 'b',
    externals: ['a'],
    exports: [],
    factory: require => {
      lazy = require
      if (!attempts++) {
        require('a')
        throw new Error('retry')
      }
      return { components: [], modules: {} }
    },
  })
  expect(() => registry.evaluate('b')).toThrow('retry')
  expect(() => lazy('a')).toThrow('stale')
  expect(registry.requests('b')).toEqual([])
  expect(registry.evaluate('b')).toBe(registry.evaluate('b'))
  expect(lazy('a')).toBe(registry.evaluate('a').modules['.'])
  expect(registry.freeze(['a'])).toEqual(['b', 'a'])
  expect(() => lazy('a')).toThrow('stale')
})
it('freezes a diamond once and blocks unrelated first reads during replacement', () => {
  const registry = new ModuleRegistry(new Map())
  const add = (name: string, dependencies: string[]) =>
    registry.register({
      package: name,
      exports: ['.'],
      externals: dependencies,
      factory: require => {
        for (const dependency of dependencies) require(dependency)
        return { modules: { '.': {} }, components: [] }
      },
    })
  add('a', [])
  add('b', ['a'])
  add('c', ['a'])
  add('d', ['b', 'c'])
  let late: RequireModule = () => ({})
  registry.register({
    package: 'late',
    exports: [],
    externals: ['a'],
    factory: require => {
      late = require
      return { modules: {}, components: [] }
    },
  })
  registry.evaluate('d')
  registry.evaluate('late')
  const order = registry.freeze(['a', 'b'])
  expect(order).toEqual(['d', 'b', 'c', 'a'])
  expect(() => late('a')).toThrow('update in progress')
  add('a', [])
  registry.finish(order)
  expect(late('a')).toBe(registry.evaluate('a').modules['.'])
})