import type { PluginArchiveDB } from '@delta-comic/db'
import { describe, expect, it, vi } from 'vite-plus/test'

import {
  _PluginInstallByAwesome,
  type AwesomeInstallerRegistry,
} from '../../../../../lib/features/core/installers/9999_awesome'
import type { AwesomePluginListing } from '../../../../../lib/marketplace'

const manifest: PluginArchiveDB.Meta = {
  author: 'delta-comic',
  description: 'Example plugin',
  entry: { jsPath: 'index.mjs' },
  name: { display: 'Example', id: 'example' },
  require: [],
  version: { plugin: '1.0.0', supportCore: '^2.3.0' },
}

const listing = (overrides: Partial<AwesomePluginListing> = {}): AwesomePluginListing => ({
  authors: ['delta-comic'],
  download: { repository: 'delta-comic/example', type: 'github' },
  id: 'example',
  schemaVersion: 1,
  ...overrides,
})

const installer = (item: AwesomePluginListing, loadedManifest?: PluginArchiveDB.Meta) => {
  const registry: AwesomeInstallerRegistry = {
    findListing: vi.fn(async () => item),
    loadManifest: vi.fn(async () => loadedManifest),
  }
  return { registry, value: new _PluginInstallByAwesome(registry) }
}

describe('awesome-plugins installer', () => {
  it.each([
    [
      'GitHub download',
      listing({ download: { repository: 'delta-comic/example', type: 'github' } }),
      'gh:delta-comic/example',
    ],
    [
      'URL download',
      listing({ download: { type: 'url', url: 'https://downloads.example.test/plugin.zip' } }),
      'https://downloads.example.test/plugin.zip',
    ],
  ])('adapts a %s union at the installer boundary', async (_, item, expected) => {
    const { value } = installer(item)

    await expect(value.download('ap:example')).resolves.toBe(expected)
  })

  it('returns the direct release manifest when available', async () => {
    const { value } = installer(listing(), manifest)

    const result = await value.fetchPluginMetaFile('ap:example')

    expect(result).toBeInstanceOf(File)
    await expect((result as File).text().then(JSON.parse)).resolves.toEqual(manifest)
  })

  it('falls back to the existing download installer when manifestUrl is null', async () => {
    const { value } = installer(listing())

    await expect(value.fetchPluginMetaFile('ap:example')).resolves.toBe('gh:delta-comic/example')
  })

  it('keeps ap:id as the persisted update input', async () => {
    const { registry, value } = installer(listing())

    await value.update({ installInput: 'ap:example' } as PluginArchiveDB.Archive)

    expect(registry.findListing).toHaveBeenCalledExactlyOnceWith('example')
  })
})