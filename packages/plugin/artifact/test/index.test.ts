import { describe, expect, it } from 'vite-plus/test'

import { sha256Integrity, validateArtifact } from '../lib/index.js'

describe('@delta-comic/plugin-artifact', () => {
  it('validates declared resources and integrity', async () => {
    const bytes = new TextEncoder().encode('export default () => undefined')
    const artifact = {
      manifest: {
        id: 'demo',
        name: 'Demo',
        version: '1.0.0',
        entryModulePath: 'index.js',
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
    await expect(validateArtifact(artifact)).resolves.toMatchObject({
      entryModule: { path: 'index.js' },
    })
  })

  it('rejects unsafe paths and integrity mismatches', async () => {
    const bytes = new TextEncoder().encode('content')
    const artifact = {
      manifest: {
        id: 'demo',
        name: 'Demo',
        version: '1.0.0',
        entryModulePath: 'index.js',
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

  it('requires the entry module to be a declared resource', async () => {
    await expect(
      validateArtifact({
        manifest: {
          id: 'demo',
          name: 'Demo',
          version: '1.0.0',
          entryModulePath: 'index.js',
          resources: [],
        },
        files: [],
      }),
    ).rejects.toThrow('entry module is not declared as a resource')
  })
})