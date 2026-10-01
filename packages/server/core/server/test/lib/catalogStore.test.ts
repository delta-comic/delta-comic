import { PluginCatalogConflictError } from '@delta-comic/both'
import { describe, expect, it } from 'vitest'

import { createR2PluginCatalogStore } from '../../lib/catalogStore'

describe('R2 plugin catalog store', () => {
  it('reads and writes a validated catalog object', async () => {
    let stored = ''
    let contentType = ''
    const store = createR2PluginCatalogStore({
      async get() {
        return stored ? { httpEtag: '"v1"', text: async () => stored } : null
      },
      async put(_key, value, options) {
        stored = value
        contentType = options?.httpMetadata?.contentType ?? ''
        return { httpEtag: '"v1"' }
      },
    })
    const index = { protocolVersion: 1 as const, generatedAt: 'now', entries: [] }

    await store.save(index)
    await expect(store.load()).resolves.toEqual(index)
    await expect(store.loadSnapshot?.()).resolves.toEqual({ index, version: '"v1"' })
    expect(contentType).toBe('application/json')
  })

  it('returns undefined for an empty bucket', async () => {
    const store = createR2PluginCatalogStore({
      async get() {
        return null
      },
      async put() {
        return { httpEtag: '"v1"' }
      },
    })

    await expect(store.load()).resolves.toBeUndefined()
    await expect(store.loadSnapshot?.()).resolves.toEqual({ index: undefined, version: null })
  })

  it('uses atomic R2 conditions for creation and updates and surfaces failed conditions', async () => {
    const conditions: (Headers | undefined)[] = []
    let writes = 0
    const store = createR2PluginCatalogStore({
      async get() {
        return null
      },
      async put(_key, _value, options) {
        conditions.push(options?.onlyIf)
        return writes++ < 2 ? { httpEtag: `"v${writes}"` } : null
      },
    })
    const index = { protocolVersion: 1 as const, generatedAt: 'now', entries: [] }

    await store.save(index, null)
    await store.save(index, '"v1"')
    await expect(store.save(index, '"stale"')).rejects.toBeInstanceOf(PluginCatalogConflictError)

    expect(conditions[0]?.get('if-none-match')).toBe('*')
    expect(conditions[0]?.has('if-match')).toBe(false)
    expect(conditions[1]?.get('if-match')).toBe('"v1"')
    expect(conditions[2]?.get('if-match')).toBe('"stale"')
  })
})