import { describe, expect, it, vi } from 'vite-plus/test'

import type { PluginInstallCatalog } from '../../../lib/install/catalog'
import type { PluginSourceResolver } from '../../../lib/install/contracts'
import { MarketplaceSourceResolver } from '../../../lib/install/source'

const delegatedSource = (matches: (input: unknown) => boolean): PluginSourceResolver => ({
  id: 'delegate',
  matches,
  resolve: vi.fn(async input => ({
    file: new File(['plugin'], 'plugin.zip'),
    installInput: String(input),
    resolverId: 'delegate',
  })),
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