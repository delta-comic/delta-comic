import { describe, expect, it, vi } from 'vite-plus/test'
import { isReactive, toRaw } from 'vue'

import './setup'

describe('temporary cross-component store', () => {
  it('creates reactive state once per id and reuses mutations across consumers', async () => {
    const { useTemp } = await import('../../lib/temp')
    const temp = useTemp()
    const factory = vi.fn(() => ({ count: 0, nested: { enabled: false } }))

    const first = temp.$apply('reactive-fixture', factory)
    first.count += 1
    first.nested.enabled = true
    const second = temp.$apply('reactive-fixture', factory)

    expect(factory).toHaveBeenCalledOnce()
    expect(second).toBe(first)
    expect(second).toEqual({ count: 1, nested: { enabled: true } })
    expect(isReactive(second)).toBe(true)
    expect(temp.$has('reactive-fixture')).toBe(true)
    expect(temp.$onlyGet('reactive-fixture')).toBe(first)
  })

  it('keeps raw and reactive namespaces independent for the same public id', async () => {
    const { useTemp } = await import('../../lib/temp')
    const temp = useTemp()
    const external = new Map([['value', 1]])

    const raw = temp.$applyRaw('shared-id', () => external)
    const reactive = temp.$apply('shared-id', () => ({ value: 2 }))

    expect(raw).toBe(external)
    expect(isReactive(raw)).toBe(false)
    expect(toRaw(reactive)).not.toBe(raw)
    expect(temp.$hasRaw('shared-id')).toBe(true)
    expect(temp.$onlyGetRaw('shared-id')).toBe(external)
  })

  it('returns undefined for ids that have never been initialized', async () => {
    const { useTemp } = await import('../../lib/temp')
    const temp = useTemp()

    expect(temp.$has('missing-reactive')).toBe(false)
    expect(temp.$onlyGet('missing-reactive')).toBeUndefined()
    expect(temp.$hasRaw('missing-raw')).toBe(false)
    expect(temp.$onlyGetRaw('missing-raw')).toBeUndefined()
  })
})