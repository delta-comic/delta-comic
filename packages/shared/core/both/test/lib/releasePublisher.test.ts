import { describe, expect, it } from 'vitest'

import type { PluginRelease } from '../../lib/release'
import { createPluginReleasePublisher } from '../../lib/releasePublisher'
import { createMemoryPluginCatalogStore, PluginCatalogConflictError } from '../../lib/releaseStore'

const release = (version: string): PluginRelease => ({
  pluginId: 'demo',
  version,
  manifestUrl: `https://plugins.example/demo/${version}/manifest.json`,
  artifacts: [
    {
      platform: 'desktop',
      url: `https://plugins.example/demo/${version}/desktop.zip`,
      mimeType: 'application/zip',
      size: 1,
      integrity: 'sha256-YQ==',
    },
  ],
  publishedAt: '2026-10-01T00:00:00Z',
})

describe('concurrent release updates', () => {
  it.each([false, true])(
    'preserves the winning publish and supports a retry (existing catalog: %s)',
    async existing => {
      const store = createMemoryPluginCatalogStore(
        existing ? { protocolVersion: 1, generatedAt: 'now', entries: [] } : undefined,
      )
      const first = createPluginReleasePublisher(store)
      const second = createPluginReleasePublisher(store)
      const metadata = { name: 'Demo' }
      const results = await Promise.allSettled([
        first.publish(release('1.0.0'), metadata),
        second.publish(release('2.0.0'), metadata),
      ])

      expect(results[0]?.status).toBe('fulfilled')
      expect(results[1]).toMatchObject({
        status: 'rejected',
        reason: expect.any(PluginCatalogConflictError),
      })
      expect((await store.load())?.entries[0]?.releases.map(item => item.version)).toEqual([
        '1.0.0',
      ])
      await second.publish(release('2.0.0'), metadata)
      expect((await store.load())?.entries[0]?.releases.map(item => item.version)).toEqual([
        '1.0.0',
        '2.0.0',
      ])
    },
  )

  it('detects an overlapping yank and preserves both changes after retry', async () => {
    const store = createMemoryPluginCatalogStore()
    const publisher = createPluginReleasePublisher(store)
    const otherPublisher = createPluginReleasePublisher(store)
    await publisher.publish(release('1.0.0'), { name: 'Demo' })
    const results = await Promise.allSettled([
      publisher.publish(release('2.0.0'), { name: 'Demo' }),
      otherPublisher.yank('demo', '1.0.0'),
    ])
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: expect.any(PluginCatalogConflictError),
    })
    await otherPublisher.yank('demo', '1.0.0')
    expect((await store.load())?.entries[0]?.releases).toMatchObject([
      { version: '1.0.0', yanked: true },
      { version: '2.0.0' },
    ])
  })

  it('publishes through a load/save store', async () => {
    const memory = createMemoryPluginCatalogStore()
    const publisher = createPluginReleasePublisher({
      load: () => memory.load(),
      save: index => memory.save(index),
    })
    await publisher.publish(release('1.0.0'), { name: 'Demo' })
    await publisher.yank('demo', '1.0.0')
    expect((await memory.load())?.entries[0]?.releases[0]?.yanked).toBe(true)
  })
})