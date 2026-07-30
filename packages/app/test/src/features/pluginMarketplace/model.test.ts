import type { PluginArchiveDB } from '@delta-comic/db'
import type { AwesomeMarketplaceEntry } from '@delta-comic/plugin'
import { describe, expect, it, vi } from 'vite-plus/test'

vi.mock('@delta-comic/plugin', () => ({
  isPluginManifestCompatible: (_manifest: unknown, coreVersion: string) => coreVersion === '2.3.0',
}))

import {
  filterPluginMarketplaceItems,
  mergePluginMarketplaceItems,
} from '../../../../src/features/pluginMarketplace/model'

const entry = (version = '2.0.0'): AwesomeMarketplaceEntry => ({
  listing: {
    authors: ['delta-comic'],
    download: { repository: 'delta-comic/example', type: 'github' },
    id: 'example',
    release: {
      manifestUrl: 'https://example.test/manifest.json',
      publishedAt: '2026-01-01T00:00:00Z',
      url: 'https://example.test/releases/2.0.0',
      version,
    },
    schemaVersion: 1,
  },
  manifest: {
    author: 'delta-comic',
    description: 'Searchable description',
    name: { display: 'Example Plugin', id: 'example' },
    require: [],
    version: { plugin: version, supportCore: '^2.3.0' },
  },
})

const installed = (version = '1.0.0') =>
  ({ meta: { version: { plugin: version } }, pluginName: 'example' }) as PluginArchiveDB.Archive

describe('plugin marketplace view model', () => {
  it('merges installed state by manifest plugin id and detects updates', () => {
    const [item] = mergePluginMarketplaceItems([entry()], [installed()], '2.3.0')

    expect(item.installed?.pluginName).toBe('example')
    expect(item.compatibility).toBe('compatible')
    expect(item.updateAvailable).toBe(true)
  })

  it('marks a real manifest supportCore mismatch as incompatible', () => {
    const [item] = mergePluginMarketplaceItems([entry()], [], '3.0.0')

    expect(item.compatibility).toBe('incompatible')
  })

  it('does not present an invalid direct manifest as safe to install', () => {
    const broken = { ...entry(), manifest: undefined, manifestError: 'manifest id mismatch' }
    const [item] = mergePluginMarketplaceItems([broken], [], '2.3.0')

    expect(item.compatibility).toBe('incompatible')
  })

  it('filters loaded items by local state and searchable metadata', () => {
    const items = mergePluginMarketplaceItems([entry()], [installed()], '2.3.0')

    expect(filterPluginMarketplaceItems(items, 'searchable', 'all')).toHaveLength(1)
    expect(filterPluginMarketplaceItems(items, '', 'updates')).toHaveLength(1)
    expect(filterPluginMarketplaceItems(items, '', 'available')).toHaveLength(0)
  })
})