import type { PluginArchiveDB } from '@delta-comic/db'
import type { AwesomeRegistryClient } from '@delta-comic/plugin'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

await vi.hoisted(async () => {
  // @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
  await import('../../../../public/runtime/host-libraries.umd.js')
})

const { installedRows } = vi.hoisted(() => ({ installedRows: [] as PluginArchiveDB.Archive[] }))

vi.mock('@delta-comic/db', () => ({
  db: {
    selectFrom: vi.fn(() => ({
      selectAll: vi.fn(() => ({ execute: vi.fn(async () => [...installedRows]) })),
    })),
  },
}))

vi.mock('@delta-comic/plugin', () => ({
  AwesomeRegistryClient: class AwesomeRegistryClient {},
  isPluginManifestCompatible: vi.fn(() => true),
}))

import { usePluginMarketplace } from '../../../../src/features/pluginMarketplace/usePluginMarketplace'

const listing = (id: string, manifestUrl = `https://example.test/${id}.json`) => ({
  authors: ['Delta Comic'],
  download: { repository: `delta-comic/${id}`, type: 'github' as const },
  id,
  release: {
    manifestUrl,
    publishedAt: '2026-01-01T00:00:00.000Z',
    url: `https://example.test/${id}`,
    version: '2.0.0',
  },
  schemaVersion: 1 as const,
})

const manifest = (id: string) => ({
  apiVersion: 1 as const,
  author: 'Delta Comic',
  description: `${id} description`,
  name: { display: `${id} display`, id },
  require: [],
  version: { plugin: '2.0.0', supportCore: '^2.3.0' },
})

const createClient = () => ({ loadIndex: vi.fn(), loadManifest: vi.fn(), loadPage: vi.fn() })

describe('usePluginMarketplace', () => {
  afterEach(() => {
    installedRows.length = 0
    vi.useRealTimers()
  })

  it('refreshes index, installed state and manifests while isolating one broken manifest', async () => {
    installedRows.push({
      meta: { version: { plugin: '1.0.0' } },
      pluginName: 'alpha',
    } as PluginArchiveDB.Archive)
    const client = createClient()
    client.loadIndex.mockResolvedValue({ data: { pages: [{ path: '/first' }] }, stale: false })
    client.loadPage.mockResolvedValue({
      data: {
        items: [listing('alpha'), listing('broken'), { ...listing('local'), release: undefined }],
        pagination: { next: '/second' },
      },
      stale: true,
    })
    client.loadManifest.mockImplementation(async item => {
      if (item.id === 'broken') throw new Error('manifest checksum mismatch')
      return manifest(item.id)
    })
    const marketplace = usePluginMarketplace({
      client: client as unknown as AwesomeRegistryClient,
      coreVersion: '2.3.0',
    })

    await marketplace.refresh()

    expect(client.loadIndex).toHaveBeenCalledOnce()
    expect(client.loadPage).toHaveBeenCalledWith('/first')
    expect(client.loadManifest).toHaveBeenCalledTimes(2)
    expect(marketplace.items.value).toHaveLength(3)
    expect(marketplace.items.value[0]).toMatchObject({
      installed: { pluginName: 'alpha' },
      updateAvailable: true,
    })
    expect(marketplace.items.value[1]).toMatchObject({
      compatibility: 'incompatible',
      manifestError: 'manifest checksum mismatch',
    })
    expect(marketplace.hasMore.value).toBe(true)
    expect(marketplace.stale.value).toBe(true)
    expect(marketplace.loading.value).toBe(false)
    expect(marketplace.error.value).toBeUndefined()
  })

  it('supports an empty registry and clears entries from an earlier refresh', async () => {
    const client = createClient()
    client.loadIndex
      .mockResolvedValueOnce({ data: { pages: [{ path: '/first' }] }, stale: false })
      .mockResolvedValueOnce({ data: { pages: [] }, stale: false })
    client.loadPage.mockResolvedValue({
      data: { items: [listing('alpha')], pagination: { next: null } },
      stale: false,
    })
    client.loadManifest.mockResolvedValue(manifest('alpha'))
    const marketplace = usePluginMarketplace({
      client: client as unknown as AwesomeRegistryClient,
      coreVersion: '2.3.0',
    })

    await marketplace.refresh()
    expect(marketplace.items.value).toHaveLength(1)
    await marketplace.refresh()

    expect(marketplace.index.value?.pages).toEqual([])
    expect(marketplace.items.value).toEqual([])
    expect(marketplace.hasMore.value).toBe(false)
  })

  it('deduplicates paginated entries and accumulates stale state', async () => {
    const client = createClient()
    client.loadIndex.mockResolvedValue({ data: { pages: [{ path: '/first' }] }, stale: true })
    client.loadPage
      .mockResolvedValueOnce({
        data: { items: [listing('alpha')], pagination: { next: '/second' } },
        stale: false,
      })
      .mockResolvedValueOnce({
        data: { items: [listing('alpha'), listing('beta')], pagination: { next: null } },
        stale: false,
      })
    client.loadManifest.mockImplementation(async item => manifest(item.id))
    const marketplace = usePluginMarketplace({
      client: client as unknown as AwesomeRegistryClient,
      coreVersion: '2.3.0',
    })

    await marketplace.refresh()
    await marketplace.loadMore()

    expect(marketplace.items.value.map(item => item.listing.id)).toEqual(['alpha', 'beta'])
    expect(marketplace.hasMore.value).toBe(false)
    expect(marketplace.stale.value).toBe(true)
    expect(marketplace.loadingMore.value).toBe(false)
  })

  it('records the failed action and retry resumes the failed page instead of refreshing', async () => {
    const client = createClient()
    client.loadIndex.mockResolvedValue({ data: { pages: [{ path: '/first' }] }, stale: false })
    client.loadPage
      .mockResolvedValueOnce({
        data: { items: [listing('alpha')], pagination: { next: '/second' } },
        stale: false,
      })
      .mockRejectedValueOnce('network offline')
      .mockResolvedValueOnce({
        data: { items: [listing('beta')], pagination: { next: null } },
        stale: false,
      })
    client.loadManifest.mockImplementation(async item => manifest(item.id))
    const marketplace = usePluginMarketplace({
      client: client as unknown as AwesomeRegistryClient,
      coreVersion: '2.3.0',
    })

    await marketplace.refresh()
    await marketplace.loadMore()
    expect(marketplace.error.value).toEqual(new Error('network offline'))

    await marketplace.retry()

    expect(client.loadIndex).toHaveBeenCalledOnce()
    expect(client.loadPage).toHaveBeenNthCalledWith(3, '/second')
    expect(marketplace.error.value).toBeUndefined()
    expect(marketplace.items.value.map(item => item.listing.id)).toEqual(['alpha', 'beta'])
  })

  it('debounces search input and rejects overlapping refresh work', async () => {
    vi.useFakeTimers()
    const client = createClient()
    let resolveIndex!: (value: unknown) => void
    client.loadIndex.mockReturnValue(new Promise(resolve => (resolveIndex = resolve)))
    const marketplace = usePluginMarketplace({
      client: client as unknown as AwesomeRegistryClient,
      coreVersion: '2.3.0',
    })

    const firstRefresh = marketplace.refresh()
    await marketplace.refresh()
    expect(client.loadIndex).toHaveBeenCalledOnce()
    resolveIndex({ data: { pages: [] }, stale: false })
    await firstRefresh

    client.loadIndex.mockResolvedValue({ data: { pages: [] }, stale: false })
    marketplace.setQuery('alpha')
    expect(marketplace.query.value).toBe('alpha')
    expect(marketplace.visibleItems.value).toEqual([])
    await vi.advanceTimersByTimeAsync(150)
    marketplace.setFilter('updates')
    expect(marketplace.filter.value).toBe('updates')
  })
})