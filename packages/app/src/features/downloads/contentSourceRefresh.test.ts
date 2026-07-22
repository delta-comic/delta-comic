import type { ContentRefreshContext } from '@delta-comic/downloader'
import type { uni } from '@delta-comic/model'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  fingerprintContentPage: vi.fn(async () => 'content-page-v1'),
  fingerprintProvider: vi.fn(async () => 'provider-v1'),
}))

vi.mock('./contentPlan', () => ({
  fingerprintContentDownloadProvider: mocks.fingerprintProvider,
  fingerprintContentPage: mocks.fingerprintContentPage,
}))

import {
  isContentSourceRefreshCandidateCurrent,
  pluginArchiveToContentRefreshIdentity,
  prepareContentSourceRefresh,
  type ContentRefreshPluginIdentity,
  type ContentSourceRefreshRuntime,
} from './contentSourceRefresh'

const context = {
  plugin: 'reader',
  contentType: ['reader', 'manga'],
  contentId: 'comic-1',
  episodeId: 'episode-2',
  contentPageFingerprint: 'content-page-v1',
  providerFingerprint: 'provider-v1',
  pluginVersion: '1.0.0',
  pluginIntegrity: 'sha256:archive-v1',
} satisfies ContentRefreshContext

const provider = {
  resolve: vi.fn(),
  refreshSource: vi.fn(),
} as unknown as uni.download.ContentDownloadProvider

function contentPageClass(
  identity: { plugin?: string; contentType?: [string, string] } = {},
): uni.content.ContentPageLike {
  return class {
    public plugin = identity.plugin ?? 'reader'
    public contentType = identity.contentType ?? ['reader', 'manga']

    constructor(
      public preload: unknown,
      public id: string,
      public ep: string,
    ) {}
  } as unknown as uni.content.ContentPageLike
}

function runtime(
  overrides: Partial<ContentSourceRefreshRuntime> = {},
): ContentSourceRefreshRuntime {
  return {
    isPluginLoaded: () => true,
    getContentPage: () => contentPageClass(),
    getDownloadProvider: () => provider,
    getPluginIdentity: () => ({
      pluginVersion: context.pluginVersion,
      pluginIntegrity: context.pluginIntegrity,
    }),
    ...overrides,
  }
}

describe('content source refresh preparation', () => {
  beforeEach(() => {
    mocks.fingerprintContentPage.mockReset().mockResolvedValue('content-page-v1')
    mocks.fingerprintProvider.mockReset().mockResolvedValue('provider-v1')
  })

  it('serializes plugin archive identity with an unambiguous integrity algorithm', () => {
    expect(
      pluginArchiveToContentRefreshIdentity({
        meta: {
          author: 'author',
          description: 'description',
          name: { display: 'Reader', id: 'reader' },
          require: [],
          version: { plugin: '2.3.4', supportCore: '*' },
          integrity: { algorithm: 'blake3', digest: 'abc123' },
        },
      }),
    ).toEqual({ pluginVersion: '2.3.4', pluginIntegrity: 'blake3:abc123' })

    expect(
      pluginArchiveToContentRefreshIdentity({
        meta: {
          author: 'author',
          description: 'description',
          name: { display: 'Reader', id: 'reader' },
          require: [],
          version: { plugin: '2.3.4', supportCore: '*' },
        },
      }),
    ).toEqual({ pluginVersion: '2.3.4', pluginIntegrity: undefined })
  })

  it('does not inspect registries before the owning plugin has loaded', async () => {
    const getContentPage = vi.fn()
    const getDownloadProvider = vi.fn()
    const getPluginIdentity = vi.fn()

    await expect(
      prepareContentSourceRefresh(
        context,
        runtime({
          isPluginLoaded: () => false,
          getContentPage,
          getDownloadProvider,
          getPluginIdentity,
        }),
      ),
    ).resolves.toEqual({ status: 'plugin-not-loaded', plugin: 'reader' })
    expect(getContentPage).not.toHaveBeenCalled()
    expect(getDownloadProvider).not.toHaveBeenCalled()
    expect(getPluginIdentity).not.toHaveBeenCalled()
  })

  it('rejects a persisted context that combines a plugin with another plugin content key', async () => {
    const isPluginLoaded = vi.fn()
    const getContentPage = vi.fn()
    const getDownloadProvider = vi.fn()
    const getPluginIdentity = vi.fn()
    const fingerprintProvider = vi.fn()
    const invalidContext = {
      ...context,
      contentType: ['other-plugin', 'manga'],
    } as ContentRefreshContext

    await expect(
      prepareContentSourceRefresh(
        invalidContext,
        runtime({
          isPluginLoaded,
          getContentPage,
          getDownloadProvider,
          getPluginIdentity,
          fingerprintProvider,
        }),
      ),
    ).resolves.toEqual({
      status: 'refresh-context-identity-mismatch',
      plugin: 'reader',
      contentType: ['other-plugin', 'manga'],
    })
    expect(isPluginLoaded).not.toHaveBeenCalled()
    expect(getContentPage).not.toHaveBeenCalled()
    expect(getDownloadProvider).not.toHaveBeenCalled()
    expect(getPluginIdentity).not.toHaveBeenCalled()
    expect(fingerprintProvider).not.toHaveBeenCalled()
  })

  it('distinguishes missing page classes, providers and source refresh support', async () => {
    await expect(
      prepareContentSourceRefresh(context, runtime({ getContentPage: () => undefined })),
    ).resolves.toEqual({ status: 'content-page-missing', contentType: context.contentType })

    const construct = vi.fn()
    const ContentPage = class {
      constructor() {
        construct()
      }
    } as unknown as uni.content.ContentPageLike

    await expect(
      prepareContentSourceRefresh(
        context,
        runtime({ getContentPage: () => ContentPage, getDownloadProvider: () => undefined }),
      ),
    ).resolves.toEqual({ status: 'download-provider-missing', contentType: context.contentType })

    await expect(
      prepareContentSourceRefresh(
        context,
        runtime({
          getContentPage: () => ContentPage,
          getDownloadProvider: () => ({ resolve: vi.fn() }),
        }),
      ),
    ).resolves.toEqual({ status: 'source-refresh-unsupported', contentType: context.contentType })
    expect(construct).not.toHaveBeenCalled()
  })

  it('constructs the registered page with no stale preload and the persisted ids', async () => {
    const constructorArguments: unknown[][] = []
    const ContentPage = class {
      public plugin = 'reader'
      public contentType = ['reader', 'manga'] as [string, string]

      constructor(...args: [unknown, string, string]) {
        constructorArguments.push(args)
      }
    } as unknown as uni.content.ContentPageLike

    const result = await prepareContentSourceRefresh(
      context,
      runtime({ getContentPage: () => ContentPage }),
    )

    expect(result.status).toBe('compatible')
    expect(constructorArguments).toEqual([[undefined, 'comic-1', 'episode-2']])
  })

  it('blocks constructor failures and reconstructed page identity drift', async () => {
    const failure = new Error('constructor failed')
    const ThrowingPage = class {
      constructor() {
        throw failure
      }
    } as unknown as uni.content.ContentPageLike

    await expect(
      prepareContentSourceRefresh(context, runtime({ getContentPage: () => ThrowingPage })),
    ).resolves.toMatchObject({ status: 'content-page-construction-failed', error: failure })

    await expect(
      prepareContentSourceRefresh(
        context,
        runtime({ getContentPage: () => contentPageClass({ plugin: 'other-reader' }) }),
      ),
    ).resolves.toMatchObject({
      status: 'content-page-identity-mismatch',
      current: { plugin: 'other-reader', contentType: ['reader', 'manga'] },
    })

    await expect(
      prepareContentSourceRefresh(
        context,
        runtime({ getContentPage: () => contentPageClass({ contentType: ['reader', 'novel'] }) }),
      ),
    ).resolves.toMatchObject({
      status: 'content-page-identity-mismatch',
      current: { plugin: 'reader', contentType: ['reader', 'novel'] },
    })
  })

  it('reports missing or unreadable installed plugin metadata explicitly', async () => {
    await expect(
      prepareContentSourceRefresh(context, runtime({ getPluginIdentity: () => undefined })),
    ).resolves.toEqual({ status: 'plugin-metadata-missing', plugin: 'reader' })
    await expect(
      prepareContentSourceRefresh(
        context,
        runtime({ getPluginIdentity: () => ({ pluginVersion: undefined }) }),
      ),
    ).resolves.toEqual({ status: 'plugin-metadata-missing', plugin: 'reader' })

    const error = new Error('database unavailable')
    await expect(
      prepareContentSourceRefresh(
        context,
        runtime({
          getPluginIdentity: () => {
            throw error
          },
        }),
      ),
    ).resolves.toEqual({ status: 'plugin-metadata-unavailable', plugin: 'reader', error })
  })

  it('reports provider fingerprint failures without exposing a refresh candidate', async () => {
    const error = new Error('fingerprint failed')
    const result = await prepareContentSourceRefresh(
      context,
      runtime({
        fingerprintProvider: () => {
          throw error
        },
      }),
    )

    expect(result).toEqual({
      status: 'provider-fingerprint-unavailable',
      contentType: context.contentType,
      error,
    })
    expect(provider.refreshSource).not.toHaveBeenCalled()
  })

  it('reports ContentPage fingerprint failures without exposing a refresh candidate', async () => {
    const error = new Error('content page fingerprint failed')
    const result = await prepareContentSourceRefresh(
      context,
      runtime({
        fingerprintContentPage: () => {
          throw error
        },
      }),
    )

    expect(result).toEqual({
      status: 'content-page-fingerprint-unavailable',
      contentType: context.contentType,
      error,
    })
    expect(provider.refreshSource).not.toHaveBeenCalled()
  })

  it('returns a refresh-ready candidate only when all recorded identities still match', async () => {
    const result = await prepareContentSourceRefresh(context, runtime())

    expect(result).toMatchObject({
      status: 'compatible',
      candidate: {
        context,
        contentPageClass: expect.any(Function),
        contentPageFingerprint: 'content-page-v1',
        provider,
        pluginIdentity: { pluginVersion: '1.0.0', pluginIntegrity: 'sha256:archive-v1' },
        providerFingerprint: 'provider-v1',
      },
    })
    expect(mocks.fingerprintProvider).toHaveBeenCalledWith(provider)
    expect(provider.refreshSource).not.toHaveBeenCalled()
  })

  it('invalidates a candidate when the plugin replaces either registered runtime object', async () => {
    const ContentPage = contentPageClass()
    let registeredContentPage = ContentPage
    let registeredProvider = provider
    const currentRuntime = runtime({
      getContentPage: () => registeredContentPage,
      getDownloadProvider: () => registeredProvider,
    })
    const result = await prepareContentSourceRefresh(context, currentRuntime)
    expect(result.status).toBe('compatible')
    if (result.status !== 'compatible') return

    expect(isContentSourceRefreshCandidateCurrent(result.candidate, currentRuntime)).toBe(true)
    registeredContentPage = contentPageClass()
    expect(isContentSourceRefreshCandidateCurrent(result.candidate, currentRuntime)).toBe(false)
    registeredContentPage = ContentPage
    registeredProvider = { ...provider }
    expect(isContentSourceRefreshCandidateCurrent(result.candidate, currentRuntime)).toBe(false)
  })

  it('requires confirmation for version, integrity, page and provider implementation changes', async () => {
    const identity: ContentRefreshPluginIdentity = {
      pluginVersion: '2.0.0',
      pluginIntegrity: 'blake3:archive-v2',
    }
    const result = await prepareContentSourceRefresh(
      context,
      runtime({
        getPluginIdentity: () => identity,
        fingerprintContentPage: () => 'content-page-v2',
        fingerprintProvider: () => 'provider-v2',
      }),
    )

    expect(result).toMatchObject({
      status: 'confirmation-required',
      changes: [
        { code: 'plugin-version-changed', recorded: '1.0.0', current: '2.0.0' },
        {
          code: 'plugin-integrity-changed',
          recorded: 'sha256:archive-v1',
          current: 'blake3:archive-v2',
        },
        {
          code: 'content-page-fingerprint-changed',
          recorded: 'content-page-v1',
          current: 'content-page-v2',
        },
        { code: 'provider-fingerprint-changed', recorded: 'provider-v1', current: 'provider-v2' },
      ],
      candidate: { provider },
    })
    expect(provider.refreshSource).not.toHaveBeenCalled()
  })

  it.each([
    ['content-page-fingerprint-changed', { fingerprintContentPage: () => 'content-page-v2' }],
    [
      'plugin-version-changed',
      {
        getPluginIdentity: () => ({ pluginVersion: '2', pluginIntegrity: context.pluginIntegrity }),
      },
    ],
    [
      'plugin-integrity-changed',
      {
        getPluginIdentity: () => ({
          pluginVersion: context.pluginVersion,
          pluginIntegrity: undefined,
        }),
      },
    ],
    ['provider-fingerprint-changed', { fingerprintProvider: () => 'changed' }],
  ] as const)('distinguishes an isolated %s warning', async (code, overrides) => {
    const result = await prepareContentSourceRefresh(context, runtime(overrides))

    expect(result.status).toBe('confirmation-required')
    if (result.status === 'confirmation-required')
      expect(result.changes.map(change => change.code)).toEqual([code])
  })
})