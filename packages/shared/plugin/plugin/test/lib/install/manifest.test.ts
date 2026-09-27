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