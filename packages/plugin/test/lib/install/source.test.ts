import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import type { PluginInstallCatalog } from '../../../lib/install/catalog'
import type { PluginSourceResolver } from '../../../lib/install/contracts'
import {
  DevServerSourceResolver,
  GitHubSourceResolver,
  HttpSourceResolver,
  MarketplaceSourceResolver,
} from '../../../lib/install/source'

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

describe('HttpSourceResolver', () => {
  it('reports streamed response bytes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('plugin', { headers: { 'content-length': String('plugin'.length) } }),
      ),
    )
    const report = vi.fn()
    const resolver = new HttpSourceResolver()

    const resolved = await resolver.resolve(
      'https://plugins.test/plugin.zip',
      new AbortController().signal,
      report,
    )

    expect(resolved.file?.size).toBe(6)
    expect(report).toHaveBeenLastCalledWith({
      downloadedBytes: 6,
      phase: 'resolve',
      progress: 100,
      totalBytes: 6,
    })
  })
})

describe('DevServerSourceResolver', () => {
  it('accepts strict dev ports and resolves the wire manifest without storing assets', async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      switch (String(input)) {
        case 'http://localhost:6173/manifest.json':
          return Response.json({ ...manifest('1.0.0') })
        case 'http://localhost:6173/index.js':
          return new Response('export default () => ({ name: "reader" })')
        case 'http://localhost:6173/index.css':
          return new Response('.reader { color: red }')
        default:
          throw new Error(`unexpected request: ${String(input)}`)
      }
    })
    vi.stubGlobal('fetch', fetch)
    const resolver = new DevServerSourceResolver()

    expect(resolver.matches('dev:6173')).toBe(true)
    expect(resolver.matches('dev:1')).toBe(true)
    expect(resolver.matches('dev:65535')).toBe(true)
    expect(resolver.matches('dev:0')).toBe(false)
    expect(resolver.matches('dev:65536')).toBe(false)
    expect(resolver.matches('dev:6173/')).toBe(false)
    expect(resolver.matches('dev:abc')).toBe(false)

    const resolved = await resolver.resolve('dev:6173', new AbortController().signal)

    expect(resolved).toMatchObject({
      installInput: 'dev:6173',
      resolverId: 'dev-server',
      storage: 'remote',
    })
    expect(resolved.file).toBeUndefined()
    expect(resolved.package).toMatchObject({ codecId: 'dev-server', files: new Map() })
    expect(fetch).toHaveBeenCalledTimes(3)
  })
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

      const report = vi.fn()
      await resolver.resolve('gh:delta-comic/reader', new AbortController().signal, report)

      expect(fetch).toHaveBeenLastCalledWith(
        `https://plugins.test/${expectedVersion}/plugin.zip`,
        expect.anything(),
      )
      expect(report).toHaveBeenLastCalledWith(
        expect.objectContaining({ downloadedBytes: 6, phase: 'resolve', progress: 100 }),
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
    expect(source.resolve).toHaveBeenCalledWith('gh:delta-comic/reader', signal, undefined)
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