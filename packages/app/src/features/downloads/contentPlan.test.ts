import type { PluginArchiveDB } from '@delta-comic/db'
import { uni } from '@delta-comic/model'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const database = vi.hoisted(() => {
  const executeTakeFirst = vi.fn()
  const where = vi.fn(() => ({ executeTakeFirst }))
  const select = vi.fn(() => ({ where }))
  const selectFrom = vi.fn(() => ({ select }))
  return { executeTakeFirst, select, selectFrom, where }
})
const model = vi.hoisted(() => {
  const toString = (key: string | [string, string]) =>
    typeof key === 'string' ? key : key.join(':')
  const registry = () => {
    const values = new Map<string, unknown>()
    return {
      clear: () => values.clear(),
      get: (key: string | [string, string]) => values.get(toString(key)),
      key: { toString },
      set: (key: string | [string, string], value: unknown) => {
        values.set(toString(key), value)
      },
    }
  }
  return { contentPages: registry(), downloadProviders: registry() }
})

vi.mock('@delta-comic/db', () => ({ db: { selectFrom: database.selectFrom } }))
vi.mock('@delta-comic/model', () => ({
  uni: {
    content: {
      ContentPage: { contentPages: model.contentPages, downloadProviders: model.downloadProviders },
    },
  },
}))

import {
  contentPlanToEnqueueInput,
  fingerprintContentPage,
  fingerprintContentDownloadProvider,
  sha256Hex,
} from './contentPlan'

const contentType: uni.content.ContentType = ['reader', 'comic']

const TestContentPage = class {
  public contentType = contentType
  public plugin = 'reader'

  public constructor(
    public preload: unknown,
    public id: string,
    public ep: string,
  ) {}
} as unknown as uni.content.ContentPageLike

const page = new TestContentPage(undefined, 'comic-1', 'episode-2')

const httpPlan: uni.download.DownloadPlan = {
  assets: [
    {
      key: 'cover',
      relativePath: 'cover.jpg',
      source: {
        expectedSize: 12,
        mirrors: [
          {
            headers: { Authorization: { secretRef: 'auth-token', type: 'secretRef' } },
            priority: 8,
            url: 'https://example.test/cover.jpg',
          },
        ],
        type: 'http',
      },
    },
  ],
  key: 'comic:1',
  title: 'Comic',
}

const resolve = async () => httpPlan

const registerProvider = (provider: uni.download.ContentDownloadProvider = { resolve }) => {
  model.contentPages.set(contentType, TestContentPage)
  uni.content.ContentPage.downloadProviders.set(contentType, provider)
  return provider
}

const archiveMeta = (
  integrity?: PluginArchiveDB.Meta['integrity'],
): Pick<PluginArchiveDB.Archive, 'meta'> => ({
  meta: {
    author: 'Delta',
    description: 'Reader',
    integrity,
    name: { display: 'Reader', id: 'reader' },
    require: [],
    version: { plugin: '3.2.1', supportCore: '^2.3.0' },
  },
})

describe('contentPlanToEnqueueInput', () => {
  beforeEach(() => {
    database.executeTakeFirst.mockReset().mockResolvedValue(undefined)
    database.selectFrom.mockClear()
    database.select.mockClear()
    database.where.mockClear()
    registerProvider()
  })

  afterEach(() => {
    model.contentPages.clear()
    uni.content.ContentPage.downloadProviders.clear()
  })

  it('preserves HTTP mirrors and persists the exact content reconstruction context', async () => {
    database.executeTakeFirst.mockResolvedValue(
      archiveMeta({ algorithm: 'sha256', digest: 'archive-digest' }),
    )

    await expect(contentPlanToEnqueueInput(httpPlan, page)).resolves.toMatchObject({
      assets: [
        {
          source: {
            expectedSize: 12,
            mirrors: [
              {
                headers: { Authorization: { secretRef: 'auth-token', type: 'secretRef' } },
                priority: 8,
                url: 'https://example.test/cover.jpg',
              },
            ],
            type: 'http',
          },
        },
      ],
      key: 'comic:1',
      refreshContext: {
        contentId: 'comic-1',
        contentPageFingerprint: expect.stringMatching(/^sha256:[\da-f]{64}$/),
        contentType: ['reader', 'comic'],
        episodeId: 'episode-2',
        plugin: 'reader',
        pluginIntegrity: 'sha256:archive-digest',
        pluginVersion: '3.2.1',
        providerFingerprint: expect.stringMatching(/^sha256:[\da-f]{64}$/),
      },
      title: 'Comic',
    })

    expect(database.selectFrom).toHaveBeenCalledExactlyOnceWith('plugin')
    expect(database.select).toHaveBeenCalledExactlyOnceWith('meta')
    expect(database.where).toHaveBeenCalledExactlyOnceWith('pluginName', '=', 'reader')
  })

  it('keeps reconstruction coordinates when the local plugin archive is missing', async () => {
    const input = await contentPlanToEnqueueInput(httpPlan, page)

    expect(input.refreshContext).toMatchObject({
      contentId: 'comic-1',
      contentType: ['reader', 'comic'],
      episodeId: 'episode-2',
      plugin: 'reader',
      providerFingerprint: expect.stringMatching(/^sha256:[\da-f]{64}$/),
    })
    expect(input.refreshContext?.pluginVersion).toBeUndefined()
    expect(input.refreshContext?.pluginIntegrity).toBeUndefined()
  })

  it('maps the selected registered destination into the native plan input', async () => {
    const input = await contentPlanToEnqueueInput(httpPlan, page, 'archive')

    expect(input.destinationId).toBe('archive')
  })

  it('rejects a plan when it was resolved by a different provider generation', async () => {
    const originalProvider = registerProvider()
    registerProvider({ resolve: async () => ({ ...httpPlan, title: 'replacement' }) })

    await expect(
      contentPlanToEnqueueInput(httpPlan, page, undefined, originalProvider),
    ).rejects.toThrow('content download runtime changed')
  })

  it('preserves torrent input and the first-reached seeding policy', async () => {
    const input = await contentPlanToEnqueueInput(
      {
        assets: [
          {
            key: 'torrent',
            relativePath: 'comic',
            source: {
              input: { type: 'magnet', uri: 'magnet:?xt=urn:btih:test' },
              seedPolicy: { durationSeconds: 600, mode: 'ratioOrDuration', ratio: 1.5 },
              type: 'torrent',
            },
          },
        ],
        key: 'comic:2',
        title: 'Torrent comic',
      },
      page,
    )

    expect(input.assets[0]?.source).toEqual({
      input: { type: 'magnet', uri: 'magnet:?xt=urn:btih:test' },
      onlyFiles: undefined,
      seedPolicy: { durationSeconds: 600, mode: 'ratioOrDuration', ratio: 1.5 },
      type: 'torrent',
    })
  })

  it('preserves literal headers for the native request layer', async () => {
    const input = await contentPlanToEnqueueInput(
      {
        assets: [
          {
            key: 'file',
            relativePath: 'file.bin',
            source: {
              mirrors: [
                {
                  headers: { Referer: { type: 'value', value: 'https://example.test/' } },
                  url: 'https://example.test/file.bin',
                },
              ],
              type: 'http',
            },
          },
        ],
        key: 'headers',
        title: 'Headers',
      },
      page,
    )

    expect(input.assets[0]?.source).toMatchObject({
      mirrors: [{ headers: { Referer: { type: 'value', value: 'https://example.test/' } } }],
    })
  })
})

describe('fingerprintContentDownloadProvider', () => {
  it('changes when the registered ContentPage class changes', async () => {
    const ReplacementContentPage = class {
      public contentType = contentType
      public plugin = 'reader'

      public constructor(
        public preload: unknown,
        public id: string,
        public ep: string,
      ) {}
    } as unknown as uni.content.ContentPageLike

    const [first, second] = await Promise.all([
      fingerprintContentPage(TestContentPage),
      fingerprintContentPage(ReplacementContentPage),
    ])

    expect(first).not.toBe(second)
  })

  it('fingerprints a provider that only implements resolve', async () => {
    await expect(fingerprintContentDownloadProvider({ resolve })).resolves.toMatch(
      /^sha256:[\da-f]{64}$/,
    )
  })

  it('changes when refreshSource implementation changes', async () => {
    const refreshSourceA: NonNullable<
      uni.download.ContentDownloadProvider['refreshSource']
    > = async input => input.source
    const refreshSourceB: NonNullable<
      uni.download.ContentDownloadProvider['refreshSource']
    > = async input => ({ ...input.source })

    const [first, second] = await Promise.all([
      fingerprintContentDownloadProvider({ refreshSource: refreshSourceA, resolve }),
      fingerprintContentDownloadProvider({ refreshSource: refreshSourceB, resolve }),
    ])

    expect(first).not.toBe(second)
  })

  it('is independent of provider property insertion order', async () => {
    const refreshSource: NonNullable<
      uni.download.ContentDownloadProvider['refreshSource']
    > = async input => input.source
    const forward = { resolve, refreshSource }
    const reverse = Object.assign({}, { refreshSource }, { resolve })

    await expect(
      Promise.all([
        fingerprintContentDownloadProvider(forward),
        fingerprintContentDownloadProvider(reverse),
      ]),
    ).resolves.toEqual([
      await fingerprintContentDownloadProvider(forward),
      await fingerprintContentDownloadProvider(forward),
    ])
  })

  it('uses a deterministic SHA-256 fallback with the same digest format', async () => {
    const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

    await expect(sha256Hex('abc', null)).resolves.toBe(expected)
    await expect(sha256Hex('abc')).resolves.toBe(expected)
  })
})