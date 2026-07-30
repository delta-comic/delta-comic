import { describe, expect, it, vi } from 'vite-plus/test'

import { AwesomeRegistryCache } from '../../../lib/marketplace/cache'
import { AwesomeRegistryClient, AwesomeRegistryNetworkError } from '../../../lib/marketplace/client'
import { AWESOME_REGISTRY_BASE_URL, type MarketplaceStorage } from '../../../lib/marketplace/types'
import { AwesomeRegistryVersionError } from '../../../lib/marketplace/validation'

class MemoryStorage implements MarketplaceStorage {
  private readonly values = new Map<string, string>()

  public getItem(key: string) {
    return this.values.get(key) ?? null
  }

  public removeItem(key: string) {
    this.values.delete(key)
  }

  public setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

const listing = (overrides: Record<string, unknown> = {}) => ({
  authors: ['delta-comic'],
  download: { repository: 'delta-comic/example', type: 'github' },
  id: 'example',
  schemaVersion: 1,
  ...overrides,
})

const index = (overrides: Record<string, unknown> = {}) => ({
  pageSize: 20,
  pages: [{ items: 1, page: 1, path: 'registry/pages/1.json' }],
  schemaVersion: 1,
  totalItems: 1,
  totalPages: 1,
  ...overrides,
})

const page = (items = [listing()]) => ({
  items,
  pagination: {
    next: null,
    page: 1,
    pageSize: 20,
    previous: null,
    totalItems: items.length,
    totalPages: 1,
  },
  schemaVersion: 1,
})

const manifest = {
  author: 'delta-comic',
  description: 'Example plugin',
  entry: { jsPath: 'index.mjs' },
  name: { display: 'Example', id: 'example' },
  require: [],
  version: { plugin: '1.0.0', supportCore: '^2.3.0' },
}

describe('awesome-plugins registry client', () => {
  it('loads the index and only the requested page', async () => {
    const requestJson = vi.fn(async (url: string) => {
      if (url.endsWith('registry/index.json')) return index()
      if (url.endsWith('registry/pages/1.json')) return page()
      throw new Error(`unexpected URL: ${url}`)
    })
    const client = new AwesomeRegistryClient({ requestJson, storage: new MemoryStorage() })

    const loadedIndex = await client.loadIndex()
    const loadedPage = await client.loadPage(loadedIndex.data.pages[0].path)

    expect(loadedIndex.stale).toBe(false)
    expect(loadedPage.data.items[0].id).toBe('example')
    expect(requestJson).toHaveBeenCalledTimes(2)
  })

  it('accepts an empty registry index without requesting a page', async () => {
    const requestJson = vi.fn(async () =>
      index({ pageSize: 20, pages: [], totalItems: 0, totalPages: 0 }),
    )
    const client = new AwesomeRegistryClient({ requestJson, storage: new MemoryStorage() })

    const result = await client.loadIndex()

    expect(result.data.pages).toEqual([])
    expect(requestJson).toHaveBeenCalledOnce()
  })

  it('surfaces an unsupported schemaVersion instead of parsing or hiding it', async () => {
    const client = new AwesomeRegistryClient({
      requestJson: async () => index({ schemaVersion: 2 }),
      storage: new MemoryStorage(),
    })

    await expect(client.loadIndex()).rejects.toThrow(AwesomeRegistryVersionError)
  })

  it('keeps listings without repository or release metadata', async () => {
    const client = new AwesomeRegistryClient({
      requestJson: async url => (url.endsWith('index.json') ? index() : page()),
      storage: new MemoryStorage(),
    })

    await expect(client.findListing('example')).resolves.toEqual(listing())
  })

  it('returns undefined when release.manifestUrl is null', async () => {
    const item = listing({
      release: {
        manifestUrl: null,
        publishedAt: '2026-02-24T13:26:22Z',
        url: 'https://github.com/delta-comic/example/releases/tag/1.0.0',
        version: '1.0.0',
      },
    })
    const requestJson = vi.fn()
    const client = new AwesomeRegistryClient({ requestJson, storage: new MemoryStorage() })

    await expect(client.loadManifest(item as never)).resolves.toBeUndefined()
    expect(requestJson).not.toHaveBeenCalled()
  })

  it('loads and validates a direct manifest.json link', async () => {
    const item = listing({
      release: {
        manifestUrl: 'https://downloads.example.test/manifest.json',
        publishedAt: '2026-02-24T13:26:22Z',
        url: 'https://downloads.example.test/releases/1.0.0',
        version: '1.0.0',
      },
    })
    const requestJson = vi.fn(async () => manifest)
    const client = new AwesomeRegistryClient({ requestJson, storage: new MemoryStorage() })

    await expect(client.loadManifest(item as never)).resolves.toEqual(manifest)
    expect(requestJson).toHaveBeenCalledExactlyOnceWith(
      'https://downloads.example.test/manifest.json',
    )
  })

  it('falls back to validated cached index and pages after a network failure', async () => {
    const storage = new MemoryStorage()
    const cache = new AwesomeRegistryCache(storage)
    const online = new AwesomeRegistryClient({
      cache,
      requestJson: async url => (url.endsWith('index.json') ? index() : page()),
    })
    await online.loadIndex()
    await online.loadPage('registry/pages/1.json')
    const offline = new AwesomeRegistryClient({
      cache,
      requestJson: async () => {
        throw new TypeError('offline')
      },
    })

    const cachedIndex = await offline.loadIndex()
    const cachedPage = await offline.loadPage('registry/pages/1.json')

    expect(cachedIndex.stale).toBe(true)
    expect(cachedPage.stale).toBe(true)
    expect(cachedPage.data.items[0].id).toBe('example')
  })

  it('reports a network error when no cache is available', async () => {
    const client = new AwesomeRegistryClient({
      baseUrl: AWESOME_REGISTRY_BASE_URL,
      requestJson: async () => {
        throw new TypeError('offline')
      },
      storage: new MemoryStorage(),
    })

    await expect(client.loadIndex()).rejects.toThrow(AwesomeRegistryNetworkError)
  })
})