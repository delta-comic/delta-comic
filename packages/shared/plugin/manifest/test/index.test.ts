import { describe, expect, it } from 'vite-plus/test'

import { isPluginManifest, parsePluginManifest, PluginManifestSchema } from '../lib/index.js'

const manifest = {
  protocolVersion: 2,
  id: 'demo',
  name: 'Demo',
  version: '1.0.0',
  client: { entry: 'index.js' },

  resources: [],
}

describe('@delta-comic/plugin-manifest', () => {
  it('validates and parses a manifest', () => {
    expect(isPluginManifest(manifest)).toBe(true)
    expect(parsePluginManifest(manifest)).toMatchObject({ id: 'demo' })
    expect(PluginManifestSchema).toBeDefined()
  })

  it('rejects malformed manifests', () => {
    expect(isPluginManifest({ ...manifest, id: 'bad id' })).toBe(false)
    expect(() => parsePluginManifest({ ...manifest, protocolVersion: 3 })).toThrow(
      'invalid plugin manifest',
    )
  })
})