import { describe, expect, it } from 'vite-plus/test'

import {
  assertPluginManifestCompatible,
  isPluginManifest,
  parsePluginManifest,
} from '../../../lib/manifest/index'

const manifest = {
  id: 'demo',
  name: 'Demo',
  version: '1.0.0',
  formatVersion: 2 as const,
  package: 'demo',
  supportCoreVersion: '*',
  exports: [],
  externals: [],
  pluginPeers: {},
  script: 'index.js',
  resources: [
    {
      path: 'index.js',
      mimeType: 'text/javascript',
      integrity: 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    },
  ],
}

describe('@delta-comic/platform/manifest', () => {
  it('validates and parses a manifest', () => {
    expect(isPluginManifest(manifest)).toBe(true)
    expect(parsePluginManifest(manifest)).toMatchObject({ id: 'demo' })
  })

  it('rejects malformed manifests', () => {
    expect(isPluginManifest({ ...manifest, id: 'bad id' })).toBe(false)
    expect(() => parsePluginManifest({ ...manifest, script: undefined })).toThrow(
      'invalid format 2 plugin manifest',
    )
    expect(isPluginManifest({ ...manifest, protocolVersion: 2 })).toBe(false)
    expect(isPluginManifest({ ...manifest, cordisVersion: '*' })).toBe(false)
    expect(isPluginManifest({ ...manifest, apiVersion: '*' })).toBe(false)
    expect(isPluginManifest({ ...manifest, supportCoreVersion: 'bad range' })).toBe(false)
  })
  it('checks the supported core version range', () => {
    const constrained = { ...manifest, supportCoreVersion: '^3.0.0' }
    expect(() => assertPluginManifestCompatible(constrained, '3.1.0')).not.toThrow()
    expect(() => assertPluginManifestCompatible(constrained, '4.0.0')).toThrow('plugin core range')
    expect(() => assertPluginManifestCompatible(manifest, '4.0.0')).not.toThrow()
  })
})