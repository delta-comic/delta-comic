import { describe, expect, it } from 'vite-plus/test'

import { field, MetaStruct, transform, type Metadatable } from '../../../lib/struct'

interface DemoRaw extends Metadatable {
  name: string
  count: number
  score?: number
}

class Demo extends MetaStruct<DemoRaw> {
  @field name!: string
  @field count!: number
  @field extra?: string
  @transform((v: number | undefined) => (v ?? 0) * 2)
  score?: number
}

describe('field decorator', () => {
  it('copies raw fields onto the instance at construction', () => {
    const demo = new Demo({ $$plugin: 'fixture', count: 3, name: 'a' })

    expect(demo.name).toBe('a')
    expect(demo.count).toBe(3)
  })

  it('leaves missing optional fields undefined', () => {
    const demo = new Demo({ $$plugin: 'fixture', count: 1, name: 'a' })

    expect(demo.extra).toBeUndefined()
  })

  it('keeps fields as own enumerable writable properties', () => {
    const demo = new Demo({ $$plugin: 'fixture', count: 1, name: 'a' })

    expect(Object.prototype.hasOwnProperty.call(demo, 'name')).toBe(true)
    expect(Object.keys(demo)).toContain('name')
    demo.name = 'b'
    expect(demo.name).toBe('b')
  })

  it('inherits $$plugin and $$meta from the base', () => {
    const demo = new Demo({ $$meta: { page: 2 }, $$plugin: 'fixture', count: 1, name: 'a' })

    expect(demo.$$plugin).toBe('fixture')
    expect(demo.$$meta).toEqual({ page: 2 })
    expect(demo.toJSON()).toEqual({ $$meta: { page: 2 }, $$plugin: 'fixture', count: 1, name: 'a' })
  })

  it('does not reflect field mutation in toJSON (init-copy semantics)', () => {
    const demo = new Demo({ $$plugin: 'fixture', count: 1, name: 'a' })

    demo.name = 'b'

    expect(demo.toJSON().name).toBe('a')
  })
})

describe('transform decorator', () => {
  it('applies the transform once at construction', () => {
    const demo = new Demo({ $$plugin: 'fixture', count: 1, name: 'a' })
    const other = new Demo({ $$plugin: 'fixture', count: 1, name: 'a', score: 5 })

    expect(demo.score).toBe(0)
    expect(other.score).toBe(10)
  })

  it('keeps toJSON on the raw value after the field is mutated', () => {
    const other = new Demo({ $$plugin: 'fixture', count: 1, name: 'a', score: 5 })

    other.score = 3

    expect(other.score).toBe(3)
    expect(other.toJSON().score).toBe(5)
  })
})