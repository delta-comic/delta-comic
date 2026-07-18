import { describe, expect, expectTypeOf, it, vi } from 'vite-plus/test'
// cspell:ignore btih

import type { ContentPage } from './content'
import {
  Downloader,
  type ContentDownloadProvider,
  type DownloadPlan,
  type DownloadSource,
  type LegacyDownloader,
} from './download'

const plan: DownloadPlan = {
  assets: [
    {
      checksum: { algorithm: 'sha256', value: 'abc123' },
      key: 'cover',
      relativePath: 'chapter-1/cover.jpg',
      size: 1024,
      source: {
        etag: '"fixture"',
        mirrors: [
          {
            headers: {
              'Authorization': { secretRef: 'fixture-token', type: 'secretRef' },
              'User-Agent': { type: 'value', value: 'delta-comic' },
            },
            priority: 10,
            url: 'https://cdn.example.test/cover.jpg',
          },
        ],
        type: 'http',
      },
    },
    {
      key: 'archive',
      relativePath: 'chapter-1.cbz',
      source: {
        input: { type: 'magnet', uri: 'magnet:?xt=urn:btih:fixture' },
        onlyFiles: [0],
        seedPolicy: { mode: 'none' },
        type: 'torrent',
      },
    },
  ],
  key: 'fixture:content-1',
  title: 'Fixture comic',
}

describe('content download contracts', () => {
  it('keeps plans and source variants JSON-serializable', () => {
    const serialized = JSON.stringify(plan)
    const parsed = JSON.parse(serialized) as DownloadPlan

    expect(parsed).toEqual(plan)
    expectTypeOf(parsed.assets[0]!.source).toEqualTypeOf<DownloadSource>()
  })

  it('passes content context and cancellation to providers', async () => {
    const page = {} as ContentPage
    const signal = new AbortController().signal
    const resolve = vi.fn(async () => plan)
    const refreshSource = vi.fn(async () => plan.assets[0]!.source)
    const provider: ContentDownloadProvider = { refreshSource, resolve }

    await expect(
      provider.resolve(
        { page, selection: { type: 'episodes', episodeIds: ['chapter-1'] } },
        signal,
      ),
    ).resolves.toBe(plan)
    await expect(
      provider.refreshSource?.(
        {
          assetKey: 'cover',
          page,
          planKey: plan.key,
          reason: 'unauthorized',
          source: plan.assets[0]!.source,
        },
        signal,
      ),
    ).resolves.toBe(plan.assets[0]!.source)

    expect(resolve).toHaveBeenCalledExactlyOnceWith(
      { page, selection: { type: 'episodes', episodeIds: ['chapter-1'] } },
      signal,
    )
    expect(refreshSource).toHaveBeenCalledExactlyOnceWith(
      {
        assetKey: 'cover',
        page,
        planKey: plan.key,
        reason: 'unauthorized',
        source: plan.assets[0]!.source,
      },
      signal,
    )
  })
})

class TestLegacyDownloader extends Downloader {
  id = 'legacy'
  name = 'Legacy downloader'
  $$plugin = 'fixture'
  $$meta = undefined
  begin = vi.fn()
  resume = vi.fn()
  pause = vi.fn()
}

describe('legacy downloader compatibility', () => {
  it('preserves the imperative controller contract during migration', () => {
    const downloader: LegacyDownloader = new TestLegacyDownloader()

    downloader.begin()
    downloader.pause()
    downloader.resume()

    expect(downloader.begin).toHaveBeenCalledOnce()
    expect(downloader.pause).toHaveBeenCalledOnce()
    expect(downloader.resume).toHaveBeenCalledOnce()
    expect(downloader).toMatchObject({ $$plugin: 'fixture', id: 'legacy' })
  })
})