import { describe, expect, it } from 'vitest'

import { createR2PluginCatalogStore } from '../../lib/catalogStore'

describe('R2 plugin catalog store', () => {
  it('reads and writes a validated catalog object', async () => {
    let stored = ''
    let contentType = ''
    const store = createR2PluginCatalogStore({
      async get() {
        return stored ? { text: async () => stored } : null
      },
      async put(_key, value, options) {
        stored = value
        contentType = options?.httpMetadata?.contentType ?? ''
      },
    })
    const index = { protocolVersion: 1 as const, generatedAt: 'now', entries: [] }

    await store.save(index)
    await expect(store.load()).resolves.toEqual(index)
    expect(contentType).toBe('application/json')
  })

  it('returns undefined for an empty bucket', async () => {
    const store = createR2PluginCatalogStore({
      async get() {
        return null
      },
      async put() {},
    })

    await expect(store.load()).resolves.toBeUndefined()
  })
})