import { describe, expect, it } from 'vite-plus/test'

import {
  assertArtifactManifestCompatible,
  parsePluginManifest,
  PluginManifestError,
} from '../../../lib'

const manifest = (overrides: Record<string, unknown> = {}) => ({
  protocolVersion: 2,
  id: 'example',
  name: 'Example',
  version: '1.0.0',
  client: { entry: 'index.js' },
  resources: [],
  ...overrides,
})

describe('plugin manifest', () => {
  it('accepts both endpoints and credential-free icons', () => {
    expect(
      parsePluginManifest(
        manifest({ server: { entry: 'flows.json' }, icon: 'https://example.test/icon.png' }),
      ),
    ).toMatchObject({ client: { entry: 'index.js' }, server: { entry: 'flows.json' } })
  })

  it('validates endpoint paths and icons', () => {
    expect(() => parsePluginManifest(manifest({ client: { entry: '../outside.js' } }))).toThrow(
      PluginManifestError,
    )
    expect(() =>
      parsePluginManifest(manifest({ icon: 'https://user:password@example.test/icon.png' })),
    ).toThrow('credential-free')
  })

  it('checks semver API compatibility', () => {
    const parsed = parsePluginManifest(manifest({ apiVersion: '^2.0.0' }))
    expect(() => assertArtifactManifestCompatible(parsed, { apiVersion: '1.0.0' })).toThrow(
      'does not support',
    )
    expect(() => assertArtifactManifestCompatible(parsed, { apiVersion: '2.1.0' })).not.toThrow()
  })
})