import { describe, expect, it } from 'vite-plus/test'

import { SourcedKeyMap, SourcedValue } from '../../../lib/struct/store'

describe('SourcedValue', () => {
  it('serializes and parses tuple values with the default separator', () => {
    const sourcedValue = new SourcedValue<[string, string]>()

    expect(sourcedValue.stringify(['plugin', 'comic'])).toBe('plugin:comic')
    expect(sourcedValue.parse('plugin:comic:chapter')).toEqual(['plugin', 'comic:chapter'])
  })

  it('normalizes JSON and string values', () => {
    const sourcedValue = new SourcedValue<[string, string]>()
    const tuple: [string, string] = ['plugin', 'comic']

    expect(sourcedValue.toJSON('plugin:comic')).toEqual(tuple)
    expect(sourcedValue.toJSON(tuple)).toBe(tuple)
    expect(sourcedValue.toString(tuple)).toBe('plugin:comic')
    expect(sourcedValue.toString('plugin:comic')).toBe('plugin:comic')
  })

  it('supports a custom separator', () => {
    const sourcedValue = new SourcedValue<[string, string]>('|')

    expect(sourcedValue.stringify(['source', 'item'])).toBe('source|item')
    expect(sourcedValue.parse('source|item|variant')).toEqual(['source', 'item|variant'])
  })
})

describe('SourcedKeyMap', () => {
  it('uses the serialized sourced key for tuple and string access', () => {
    const map = new SourcedKeyMap<[string, string], number>()

    map.set(['plugin', 'comic'], 1)

    expect(map.get('plugin:comic')).toBe(1)
    expect(map.has(['plugin', 'comic'])).toBe(true)
    expect(map.delete('plugin:comic')).toBe(true)
    expect(map.has(['plugin', 'comic'])).toBe(false)
  })

  it('inserts missing values without replacing existing values', () => {
    const map = new SourcedKeyMap<[string, string], number>()

    expect(map.getOrInsert(['plugin', 'comic'], 1)).toBe(1)
    expect(map.getOrInsert('plugin:comic', 2)).toBe(1)
    expect(map.get('plugin:comic')).toBe(1)
  })

  it('computes missing values once with the serialized key', () => {
    const map = new SourcedKeyMap<[string, string], string>()
    const computedKeys: string[] = []

    const firstValue = map.getOrInsertComputed(['plugin', 'comic'], key => {
      computedKeys.push(key)
      return `${key}:computed`
    })
    const secondValue = map.getOrInsertComputed('plugin:comic', key => {
      computedKeys.push(key)
      return `${key}:second`
    })

    expect(firstValue).toBe('plugin:comic:computed')
    expect(secondValue).toBe(firstValue)
    expect(computedKeys).toEqual(['plugin:comic'])
  })

  it('exposes map-like iteration over serialized keys', () => {
    const map = new SourcedKeyMap<[string, string], number>()

    map.set(['plugin', 'comic'], 1).set(['plugin', 'chapter'], 2)

    expect(map.size).toBe(2)
    expect([...map.keys()]).toEqual(['plugin:comic', 'plugin:chapter'])
    expect([...map.values()]).toEqual([1, 2])
    expect([...map.entries()]).toEqual([
      ['plugin:comic', 1],
      ['plugin:chapter', 2],
    ])
    expect([...map]).toEqual([...map.entries()])
  })

  it('supports forEach, clear, and reactive construction', () => {
    const map = SourcedKeyMap.createReactive<[string, string], number>()
    const visited: Array<[string, number, SourcedKeyMap<[string, string], number>]> = []
    const thisArg = { label: 'context' }
    const seenThisArgs: unknown[] = []

    map.set(['plugin', 'comic'], 1)
    map.forEach(function (this: typeof thisArg, value, key, collection) {
      seenThisArgs.push(this)
      visited.push([key, value, collection as SourcedKeyMap<[string, string], number>])
    }, thisArg)

    expect(map).toBeInstanceOf(SourcedKeyMap)
    expect(seenThisArgs).toEqual([thisArg])
    expect(visited).toEqual([['plugin:comic', 1, map]])

    map.clear()

    expect(map.size).toBe(0)
  })
})