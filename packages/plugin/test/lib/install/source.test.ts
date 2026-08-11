import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import type { PluginInstallCatalog } from '../../../lib/install/catalog'
import type { PluginSourceResolver } from '../../../lib/install/contracts'
import { GitHubSourceResolver, MarketplaceSourceResolver } from '../../../lib/install/source'

const octokit = vi.hoisted(() => ({ pages: [] as Array<{ data: Array<Record<string, unknown>> }> }))

vi.mock('@octokit/rest', () => ({
  Octokit: class {
    public readonly paginate = {
      iterator: async function* () {
        yield* octokit.pages
      },
    }

    public readonly rest = { repos: { listReleases: vi.fn() } }
  },
}))

const delegatedSource = (matches: (input: unknown) => boolean): PluginSourceResolver => ({
  id: 'delegate',
  matches,
  resolve: vi.fn(async input => ({
    file: new File(['plugin'], 'plugin.zip'),
    installInput: String(input),
    resolverId: 'delegate',
  })),
})

const manifest = (version: string) => ({
  apiVersion: 1,
  author: 'test',
  description: 'test',
  name: { display: 'Reader', id: 'reader' },
  require: [],
  version: { plugin: version, supportCore: '*' },
})

const release = (version: string, prerelease: boolean) => ({
  assets: [
    {
      browser_download_url: `https://plugins.test/${version}/manifest.json`,
      name: 'manifest.json',
    },
    { browser_download_url: `https://plugins.test/${version}/plugin.zip`, name: 'plugin.zip' },
  ],
  draft: false,
  prerelease,
})

afterEach(() => {
  octokit.pages = []
  vi.unstubAllGlobals()
})

describe('GitHubSourceResolver', () => {
  it.each([
    { expectedVersion: '1.0.0', includePrereleases: false },
    { expectedVersion: '2.0.0-next.1', includePrereleases: true },
  ])(
    'selects $expectedVersion when includePrereleases is $includePrereleases',
    async ({ expectedVersion, includePrereleases }) => {
      octokit.pages = [{ data: [release('2.0.0-next.1', true), release('1.0.0', false)] }]
      const fetch = vi.fn(async (input: string | URL | Request) => {
        const url = String(input)
        const version = url.split('/').at(-2) as string
        return url.endsWith('/manifest.json')
          ? Response.json(manifest(version))
          : new Response('plugin')
      })
      vi.stubGlobal('fetch', fetch)
      const resolver = new GitHubSourceResolver({
        coreVersion: '3.0.0',
        includePrereleases: () => includePrereleases,
      })

      await resolver.resolve('gh:delta-comic/reader', new AbortController().signal)

      expect(fetch).toHaveBeenLastCalledWith(
        `https://plugins.test/${expectedVersion}/plugin.zip`,
        expect.anything(),
      )
    },
  )
})

describe('MarketplaceSourceResolver', () => {
  it('resolves a catalog id through an injected catalog and source resolver', async () => {
    const signal = new AbortController().signal
    const catalog: PluginInstallCatalog = {
      resolveInstallInput: vi.fn(async () => 'gh:delta-comic/reader'),
    }
    const source = delegatedSource(input => input === 'gh:delta-comic/reader')
    const resolver = new MarketplaceSourceResolver(catalog, [source])

    const resolved = await resolver.resolve('ap:reader', signal)

    expect(catalog.resolveInstallInput).toHaveBeenCalledWith('reader', signal)
    expect(source.resolve).toHaveBeenCalledWith('gh:delta-comic/reader', signal)
    expect(resolved).toMatchObject({ installInput: 'ap:reader', resolverId: 'marketplace' })
    expect(resolver.matches('ap:reader')).toBe(true)
    expect(resolver.matches('https://example.test/reader.zip')).toBe(false)
  })

  it('fails explicitly when a catalog returns an unsupported source', async () => {
    const catalog: PluginInstallCatalog = {
      resolveInstallInput: vi.fn(async () => 'custom:reader'),
    }
    const resolver = new MarketplaceSourceResolver(catalog, [])

    await expect(resolver.resolve('ap:reader', new AbortController().signal)).rejects.toThrow(
      'unsupported install source',
    )
  })
})