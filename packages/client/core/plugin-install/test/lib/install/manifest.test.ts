import type { PluginManifest as ArtifactManifest } from '@delta-comic/plugin-manifest'
import { describe, expect, it } from 'vitest'

import {
  assertArtifactDependencies,
  assertArtifactManifestCompatible,
  parsePluginManifest,
  PluginManifestError,
} from '../../../lib'

const manifest = (overrides: Record<string, unknown> = {}) => ({
  apiVersion: 1,
  author: 'test',
  description: 'test',
  name: { display: 'Example', id: 'example' },
  require: [],
  version: { plugin: '1.0.0', supportCore: '*' },
  ...overrides,
})

describe('plugin manifest v1', () => {
  it('ignores removed entry fields and accepts credential-free remote icons', () => {
    expect(
      parsePluginManifest(
        manifest({
          entry: { cssPath: 'src/style.css', jsPath: 'src/main.ts' },
          icon: 'https://example.test/icon.png',
        }),
      ),
    ).toMatchObject({ apiVersion: 1, icon: 'https://example.test/icon.png' })
    expect(
      parsePluginManifest(manifest({ entry: { jsPath: '../outside.mjs' } })),
    ).not.toHaveProperty('entry')
  })

  it('ignores the removed legacy plugin kind field', () => {
    expect(parsePluginManifest(manifest({ kind: 'preboot' }))).not.toHaveProperty('kind')
  })

  it('rejects unsupported protocol versions and unsafe identifiers', () => {
    expect(() => parsePluginManifest(manifest({ apiVersion: 0 }))).toThrow(PluginManifestError)
    expect(() =>
      parsePluginManifest(manifest({ name: { display: 'Unsafe', id: 'unsafe:name' } })),
    ).toThrow('portable')
  })
})

describe('artifact manifest compatibility', () => {
  const artifact = (overrides: Partial<ArtifactManifest> = {}): ArtifactManifest => ({
    protocolVersion: 1,
    id: 'reader',
    name: 'Reader',
    version: '1.0.0',
    entry: 'index.js',
    entryType: 'plugin',
    resources: [],
    ...overrides,
  })

  it('checks protocol and semver API compatibility', () => {
    expect(() =>
      assertArtifactManifestCompatible(artifact({ apiVersion: '^2.0.0' }), {
        protocolVersion: 1,
        apiVersion: '1.0.0',
      }),
    ).toThrow('does not support')
    expect(() =>
      assertArtifactManifestCompatible(artifact({ apiVersion: '^1.0.0' }), {
        protocolVersion: 1,
        apiVersion: '1.2.0',
      }),
    ).not.toThrow()
  })

  it('checks dependency presence, versions and cycles', () => {
    const manifest = artifact({ dependencies: [{ id: 'base', version: '^1.0.0' }] })
    expect(() => assertArtifactDependencies(manifest, [])).toThrow('missing')
    expect(() => assertArtifactDependencies(manifest, [{ id: 'base', version: '2.0.0' }])).toThrow(
      'version mismatch',
    )
    expect(() =>
      assertArtifactDependencies(manifest, [{ id: 'base', version: '1.2.0' }]),
    ).not.toThrow()
    expect(() =>
      assertArtifactDependencies(artifact({ dependencies: [{ id: 'reader' }] }), []),
    ).toThrow('cycle')
  })
})