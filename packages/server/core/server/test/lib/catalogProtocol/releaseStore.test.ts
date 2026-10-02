import { describe, expect, it } from 'vite-plus/test'

import {
  createHttpPluginCatalogStore,
  createMemoryPluginCatalogStore,
  PluginCatalogConflictError,
} from '../../../lib/catalogProtocol/releaseStore.js'

const index = { protocolVersion: 1 as const, generatedAt: 'now', entries: [] }

describe('catalog store versions', () => {
  it('rejects stale versions including competing initial writes', async () => {
    const store = createMemoryPluginCatalogStore()
    await expect(store.loadSnapshot?.()).resolves.toEqual({ index: undefined, version: null })
    await store.save(index, null)
    await expect(store.save(index, null)).rejects.toBeInstanceOf(PluginCatalogConflictError)

    const snapshot = await store.loadSnapshot?.()
    expect(snapshot?.version).toBeTypeOf('string')
    await store.save({ ...index, generatedAt: 'next' }, snapshot?.version)
    await expect(store.save(index, snapshot?.version)).rejects.toBeInstanceOf(
      PluginCatalogConflictError,
    )
    await expect(store.load()).resolves.toMatchObject({ generatedAt: 'next' })
  })

  it('keeps saved indexes and returned snapshots isolated from caller mutations', async () => {
    const initial = { ...index }
    const store = createMemoryPluginCatalogStore(initial)
    initial.generatedAt = 'mutated'
    const loaded = await store.load()
    if (loaded) loaded.generatedAt = 'mutated'
    const snapshot = await store.loadSnapshot?.()
    if (snapshot?.index) snapshot.index.generatedAt = 'mutated'
    await expect(store.load()).resolves.toEqual(index)

    const saved = { ...index, generatedAt: 'saved' }
    await store.save(saved)
    saved.generatedAt = 'mutated'
    await expect(store.load()).resolves.toMatchObject({ generatedAt: 'saved' })
  })

  it('reads HTTP ETags and sends conditional updates and creates', async () => {
    const requests: RequestInit[] = []
    const store = createHttpPluginCatalogStore(
      'https://plugins.example/catalog.json',
      async (_url, init) => {
        requests.push(init ?? {})
        return new Response(JSON.stringify(index), { headers: { etag: '"v1"' } })
      },
    )

    await expect(store.loadSnapshot?.()).resolves.toEqual({ index, version: '"v1"' })
    await store.save(index, '"v1"')
    await store.save(index, null)
    expect(requests[0]?.cache).toBe('no-store')
    expect(new Headers(requests[1]?.headers).get('if-match')).toBe('"v1"')
    expect(new Headers(requests[2]?.headers).get('if-none-match')).toBe('*')
  })

  it('handles absent HTTP catalogs, missing ETags, conflicts and upstream failures', async () => {
    const responses = [
      new Response(null, { status: 404 }),
      new Response(JSON.stringify(index)),
      new Response(null, { status: 412 }),
      new Response(null, { status: 500 }),
      new Response(null, { status: 500 }),
    ]
    const store = createHttpPluginCatalogStore('https://plugins.example/catalog.json', async () => {
      const response = responses.shift()
      if (!response) throw new Error('unexpected request')
      return response
    })

    await expect(store.loadSnapshot?.()).resolves.toEqual({ index: undefined, version: null })
    await expect(store.loadSnapshot?.()).rejects.toThrow('missing ETag')
    await expect(store.save(index, '"v1"')).rejects.toBeInstanceOf(PluginCatalogConflictError)
    await expect(store.loadSnapshot?.()).rejects.toThrow('catalog request failed: 500')
    await expect(store.save(index, null)).rejects.toThrow('catalog update failed: 500')
  })
})