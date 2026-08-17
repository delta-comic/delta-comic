import { describe, expect, it } from 'vitest'

import { parsePluginManifest, PluginManifestError } from '../../../lib/install'

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
  it('accepts safe entries and credential-free remote icons', () => {
    expect(
      parsePluginManifest(
        manifest({
          entry: { cssPath: 'assets/index.css', jsPath: 'index.mjs' },
          icon: 'https://example.test/icon.png',
        }),
      ),
    ).toMatchObject({
      apiVersion: 1,
      entry: { cssPath: 'assets/index.css', jsPath: 'index.mjs' },
      icon: 'https://example.test/icon.png',
    })
  })

  it('ignores the removed legacy plugin kind field', () => {
    expect(parsePluginManifest(manifest({ kind: 'preboot' }))).not.toHaveProperty('kind')
  })

  it('rejects unsupported protocol versions and traversal paths', () => {
    expect(() => parsePluginManifest(manifest({ apiVersion: 0 }))).toThrow(PluginManifestError)
    expect(() => parsePluginManifest(manifest({ entry: { jsPath: '../outside.mjs' } }))).toThrow(
      'safe relative path',
    )
    expect(() =>
      parsePluginManifest(manifest({ name: { display: 'Unsafe', id: 'unsafe:name' } })),
    ).toThrow('portable')
  })
})
