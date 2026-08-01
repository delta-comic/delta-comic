import { describe, expect, it, vi } from 'vite-plus/test'

import { AwesomeRegistryClient } from '../../../../lib/adapters/awesomeRegistry/client'
import type { AwesomeRegistryStorage } from '../../../../lib/adapters/awesomeRegistry/types'

const indexPayload = {
  pageSize: 10,
  pages: [{ items: 1, page: 1, path: 'registry/pages/1.json' }],
  schemaVersion: 1,
  totalItems: 1,
  totalPages: 1,
}

const pagePayload = {
  items: [
    {
      authors: ['delta-comic'],
      download: { repository: 'delta-comic/reader', type: 'github' },
      id: 'reader',
      release: {
        manifestUrl: 'https://plugins.test/reader/manifest.json',
        publishedAt: '2026-01-01T00:00:00.000Z',
        url: 'https://plugins.test/reader/releases/2.0.0',
        version: '2.0.0',
      },
      schemaVersion: 1,
    },
  ],
  pagination: { next: null, page: 1, pageSize: 10, previous: null, totalItems: 1, totalPages: 1 },
  schemaVersion: 1,
}

const manifestPayload = {
  apiVersion: 1,
  author: 'delta-comic',
  description: 'Reader',
  name: { display: 'Reader', id: 'reader' },
  require: [],
  version: { plugin: '2.0.0', supportCore: '^3.0.0' },
}

const memoryStorage = (): AwesomeRegistryStorage => {
  const values = new Map<string, string>()
  return {
    getItem: key => values.get(key) ?? null,
    removeItem: key => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  }
}

describe('AwesomeRegistryClient', () => {
  it('maps the external registry schema to the provider-neutral catalog contract', async () => {
    const requestJson = vi.fn(async (url: string) =>
      url.endsWith('index.json') ? indexPayload : pagePayload,
    )
    const client = new AwesomeRegistryClient({
      baseUrl: 'https://plugins.test/',
      requestJson,
      storage: memoryStorage(),
    })

    const index = await client.loadIndex()
    const page = await client.loadPage(index.data.pages[0]!.path)

    expect(index.data).toEqual({
      pageSize: 10,
      pages: [{ items: 1, page: 1, path: 'registry/pages/1.json' }],
      totalItems: 1,
      totalPages: 1,
    })
    expect(page.data.items[0]).toMatchObject({
      id: 'reader',
      source: { repository: 'delta-comic/reader', type: 'github' },
    })
    expect(page.data.items[0]).not.toHaveProperty('schemaVersion')
  })

  it('resolves installs through catalog data and validates fetched manifest identity', async () => {
    const requestJson = vi.fn(async (url: string) => {
      if (url.endsWith('index.json')) return indexPayload
      if (url.endsWith('1.json')) return pagePayload
      return manifestPayload
    })
    const client = new AwesomeRegistryClient({
      baseUrl: 'https://plugins.test/',
      requestJson,
      storage: memoryStorage(),
    })
    const signal = new AbortController().signal

    expect(await client.resolveInstallInput('reader', signal)).toBe('gh:delta-comic/reader')
    const listing = (await client.loadPage('registry/pages/1.json')).data.items[0]!
    expect(await client.loadManifest(listing, signal)).toEqual(manifestPayload)
    expect(requestJson).toHaveBeenLastCalledWith(
      'https://plugins.test/reader/manifest.json',
      signal,
    )

    requestJson.mockResolvedValueOnce({
      ...manifestPayload,
      name: { display: 'Other', id: 'other' },
    })
    await expect(client.loadManifest(listing)).rejects.toThrow(
      'listing reader points to manifest for other',
    )
  })

  it('falls back to validated stale cache after a network failure', async () => {
    const storage = memoryStorage()
    const requestJson = vi.fn().mockResolvedValueOnce(indexPayload).mockRejectedValueOnce('offline')
    const client = new AwesomeRegistryClient({ requestJson, storage })

    expect((await client.loadIndex()).stale).toBe(false)
    const fallback = await client.loadIndex()

    expect(fallback.stale).toBe(true)
    expect(fallback.data.totalItems).toBe(1)
  })
})