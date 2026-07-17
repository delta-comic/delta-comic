import { describe, expect, it } from 'vite-plus/test'

import { isPluginManifestCompatible, parsePluginManifest, PluginManifestError } from './manifest'

const manifest = {
  author: 'delta-comic',
  description: 'A plugin bundled by the Delta Comic Vite plugin',
  entry: { cssPath: 'index.css', jsPath: 'index.mjs' },
  icon: 'assets/icon.png',
  name: { display: 'Marketplace Test', id: 'marketplace-test' },
  require: [{ download: 'ap:layout', id: 'layout' }],
  version: { plugin: '1.2.3', supportCore: '^2.3.0' },
}

describe('Delta Comic plugin manifest', () => {
  it('parses the manifest.json format emitted by the Vite plugin', () => {
    expect(parsePluginManifest(JSON.parse(JSON.stringify(manifest)))).toEqual(manifest)
  })

  it('uses supportCore for the existing semver compatibility decision', () => {
    const parsed = parsePluginManifest(manifest)

    expect(isPluginManifestCompatible(parsed, '2.3.0')).toBe(true)
    expect(isPluginManifestCompatible(parsed, '3.0.0')).toBe(false)
  })

  it('rejects incomplete manifests and unsafe entry paths', () => {
    expect(() => parsePluginManifest({ version: { supportCore: '*' } })).toThrow(
      PluginManifestError,
    )
    expect(() => parsePluginManifest({ ...manifest, entry: { jsPath: '../outside.mjs' } })).toThrow(
      'safe relative path',
    )
  })

  it('preserves optional runtime, integrity and dependency metadata', () => {
    const full = {
      ...manifest,
      entry: { jsPath: 'dist/index.mjs' },
      integrity: { algorithm: 'sha256', digest: 'abc123' },
      kind: 'preboot',
      require: [{ id: 'layout' }, { download: 'ap:reader', id: 'reader' }],
    }

    expect(parsePluginManifest(full)).toMatchObject(full)
    expect(
      parsePluginManifest({ ...full, integrity: { algorithm: 'blake3', digest: 'def456' } }),
    ).toMatchObject({ integrity: { algorithm: 'blake3', digest: 'def456' } })
    expect(parsePluginManifest({ ...full, kind: 'normal' })).toMatchObject({ kind: 'normal' })
  })

  it.each([
    ['local archive path', 'images/icon.svg?theme=dark'],
    ['remote HTTPS URL', 'https://cdn.example.test/plugin/icon.webp'],
    ['remote HTTP URL', 'http://localhost:4173/icon.png'],
  ])('preserves a valid %s icon', (_case, icon) => {
    expect(parsePluginManifest({ ...manifest, icon })).toMatchObject({ icon })
  })

  it.each([
    ['array manifest', [], 'manifest must be an object'],
    ['unsafe dot id', { ...manifest, name: { ...manifest.name, id: '..' } }, 'unsafe path segment'],
    [
      'unsafe slash id',
      { ...manifest, name: { ...manifest.name, id: 'group/plugin' } },
      'unsafe path segment',
    ],
    ['non-array dependencies', { ...manifest, require: {} }, 'manifest.require must be an array'],
    [
      'non-object dependency',
      { ...manifest, require: [null] },
      'manifest.require[0] must be an object',
    ],
    [
      'invalid dependency download',
      { ...manifest, require: [{ download: 42, id: 'layout' }] },
      'manifest.require[0].download must be a string',
    ],
    [
      'missing dependency id',
      { ...manifest, require: [{}] },
      'manifest.require[0].id must be a non-empty string',
    ],
    [
      'absolute entry',
      { ...manifest, entry: { jsPath: '/index.mjs' } },
      'manifest.entry.jsPath must be a safe relative path',
    ],
    [
      'backslash traversal',
      { ...manifest, entry: { cssPath: '..\\index.css', jsPath: 'index.mjs' } },
      'manifest.entry.cssPath must be a safe relative path',
    ],
    ['empty icon', { ...manifest, icon: '   ' }, 'manifest.icon must be a non-empty string'],
    ['non-string icon', { ...manifest, icon: 42 }, 'manifest.icon must be a non-empty string'],
    [
      'icon traversal',
      { ...manifest, icon: 'images/%2e%2e/private.png' },
      'manifest.icon must be a safe relative path',
    ],
    [
      'encoded Windows traversal',
      { ...manifest, icon: 'images/%2e%2e%5c' + 'private.png' },
      'manifest.icon must be a safe relative path',
    ],
    [
      'encoded Windows drive path',
      { ...manifest, icon: 'C%3A%5c' + 'private.png' },
      'manifest.icon must be a safe relative path',
    ],
    [
      'credentialed icon',
      { ...manifest, icon: 'https://token@example.com/icon.png' },
      'credential-free HTTP(S)',
    ],
    ['local file icon', { ...manifest, icon: 'file:///tmp/icon.png' }, 'credential-free HTTP(S)'],
    [
      'invalid kind',
      { ...manifest, kind: 'system' },
      'manifest.kind must be "normal" or "preboot"',
    ],
    [
      'non-object integrity',
      { ...manifest, integrity: 'sha256:abc' },
      'manifest.integrity must be an object',
    ],
    [
      'invalid integrity algorithm',
      { ...manifest, integrity: { algorithm: 'md5', digest: 'abc' } },
      'manifest.integrity.algorithm is unsupported',
    ],
    [
      'empty integrity digest',
      { ...manifest, integrity: { algorithm: 'sha256', digest: '' } },
      'manifest.integrity.digest must be a non-empty string',
    ],
  ])('rejects %s', (_case, value, message) => {
    expect(() => parsePluginManifest(value)).toThrow(message as string)
  })
})