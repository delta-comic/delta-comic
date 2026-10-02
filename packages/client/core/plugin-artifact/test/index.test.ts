import { describe, expect, it } from 'vitest'

import { sha256Integrity, validateArtifact } from '../lib/index.js'

describe('@delta-comic/plugin-artifact', () => {
  it('validates declared resources and integrity', async () => {
    const bytes = new TextEncoder().encode('export default () => undefined')
    const artifact = {
      manifest: {
        protocolVersion: 1 as const,
        id: 'demo',
        name: 'Demo',
        version: '1.0.0',
        entry: 'index.js',
        entryType: 'plugin' as const,
        resources: [
          {
            path: 'index.js',
            mimeType: 'text/javascript',
            integrity: await sha256Integrity(bytes),
            imports: [],
          },
        ],
      },
      files: [{ path: 'index.js', bytes }],
    }
    await expect(validateArtifact(artifact)).resolves.toMatchObject({ entry: { path: 'index.js' } })
  })

  it('rejects unsafe paths and integrity mismatches', async () => {
    const bytes = new TextEncoder().encode('content')
    const artifact = {
      manifest: {
        protocolVersion: 1 as const,
        id: 'demo',
        name: 'Demo',
        version: '1.0.0',
        entry: 'index.js',
        entryType: 'plugin' as const,
        resources: [
          {
            path: 'index.js',
            mimeType: 'text/javascript',
            integrity: await sha256Integrity(bytes),
            imports: [],
          },
        ],
      },
      files: [{ path: '../index.js', bytes }],
    }
    await expect(validateArtifact(artifact)).rejects.toThrow('unsafe relative path')
  })

  it('validates only resources selected for the target platform', async () => {
    const bytes = new TextEncoder().encode('export default 1')
    const integrity = await sha256Integrity(bytes)
    const manifest = {
      protocolVersion: 1 as const,
      id: 'platform-plugin',
      name: 'Platform Plugin',
      version: '1.0.0',
      entry: 'index.js',
      entryType: 'plugin' as const,
      resources: [
        {
          path: 'index.js',
          mimeType: 'text/javascript',
          integrity,
          imports: [],
          platform: ['desktop'],
        },
        {
          path: 'android.js',
          mimeType: 'text/javascript',
          integrity: 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          imports: [],
          platform: ['android'],
        },
      ],
    }

    await expect(
      validateArtifact({ manifest, files: [{ path: 'index.js', bytes }] }, { platform: 'desktop' }),
    ).resolves.toMatchObject({ entry: { path: 'index.js' } })
    await expect(
      validateArtifact({ manifest, files: [{ path: 'index.js', bytes }] }, { platform: 'android' }),
    ).rejects.toThrow('entry is not declared as a resource')
  })
})