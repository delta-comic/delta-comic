import { sha256Integrity } from '@delta-comic/plugin-artifact'
import JSZip from 'jszip'
import { describe, expect, it } from 'vite-plus/test'

import { ArtifactZipPackageCodec } from '../../../lib'

const archive = async (entry = 'export default () => ({})') => {
  const bytes = new TextEncoder().encode(entry)
  const zip = new JSZip()
  zip.file(
    'manifest.json',
    JSON.stringify({
      protocolVersion: 1,
      id: 'artifact-reader',
      name: 'Artifact Reader',
      version: '1.0.0',
      entry: 'index.js',
      entryType: 'plugin',
      resources: [
        {
          path: 'index.js',
          mimeType: 'text/javascript',
          integrity: await sha256Integrity(bytes),
          imports: [],
        },
      ],
    }),
  )
  zip.file('index.js', bytes)
  return new File([await zip.generateAsync({ type: 'uint8array' })], 'plugin.zip')
}

describe('ArtifactZipPackageCodec', () => {
  it('decodes and validates the current artifact protocol', async () => {
    const decoded = await new ArtifactZipPackageCodec().decode(
      await archive(),
      new AbortController().signal,
    )
    expect(decoded.manifest.id).toBe('artifact-reader')
    expect(decoded.files.has('index.js')).toBe(true)
  })

  it('rejects a resource whose integrity does not match the ZIP bytes', async () => {
    const file = await archive()
    const zip = await JSZip.loadAsync(new Uint8Array(await file.arrayBuffer()))
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('text')) as {
      resources: [{ integrity: string }]
    }
    manifest.resources[0].integrity = 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
    zip.file('manifest.json', JSON.stringify(manifest))
    const invalid = new File([await zip.generateAsync({ type: 'uint8array' })], 'plugin.zip')

    await expect(
      new ArtifactZipPackageCodec().decode(invalid, new AbortController().signal),
    ).rejects.toThrow('integrity mismatch')
  })
})