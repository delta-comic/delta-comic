import type { PluginManifest } from '@delta-comic/model'
import { validateArtifact, type PluginArtifact } from '@delta-comic/plugin-artifact'
import {
  assertPluginManifestCompatible,
  parsePluginManifest as parseArtifactManifest,
  type PluginManifest as ArtifactManifest,
  type PluginManifestCompatibility,
} from '@delta-comic/plugin-manifest'
import JSZip from 'jszip'

import type {
  DecodedPluginArtifactPackage,
  DecodedPluginPackage,
  PluginPackageCodec,
} from './contracts'
import { parsePluginManifest, safePluginPath } from './manifest'

const sha256 = async (bytes: Uint8Array) => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}

const withIntegrity = async (manifest: PluginManifest, bytes: Uint8Array) => ({
  ...manifest,
  integrity: { algorithm: 'sha256' as const, digest: await sha256(bytes) },
})

export class ZipPackageCodec implements PluginPackageCodec {
  public readonly id = 'zip'

  public matches(file: File) {
    return file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip'
  }

  public async decode(file: File, signal: AbortSignal): Promise<DecodedPluginPackage> {
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (signal.aborted) throw signal.reason
    const archive = await JSZip.loadAsync(bytes)
    const manifestFile = archive.file('manifest.json')
    if (!manifestFile) throw new Error('plugin archive does not contain manifest.json')
    const manifest = await withIntegrity(
      parsePluginManifest(JSON.parse(await manifestFile.async('text'))),
      bytes,
    )
    const files = new Map<string, Uint8Array>()
    for (const entry of Object.values(archive.files)) {
      if (signal.aborted) throw signal.reason
      if (entry.dir) continue
      const path = safePluginPath(entry.name, `archive entry ${entry.name}`)
      files.set(path, await entry.async('uint8array'))
    }
    return { codecId: this.id, files, manifest }
  }
}

/** Decodes the current protocol ZIP layout and validates every declared resource. */
export interface ArtifactZipPackageCodecOptions {
  readonly compatibility?: PluginManifestCompatibility
  readonly platform?: string
}

export class ArtifactZipPackageCodec {
  public readonly id = 'artifact-zip'

  public constructor(private readonly options: ArtifactZipPackageCodecOptions = {}) {}

  public matches(file: File) {
    return file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip'
  }

  public async decode(file: File, signal: AbortSignal): Promise<DecodedPluginArtifactPackage> {
    const bytes = new Uint8Array(await file.arrayBuffer())
    signal.throwIfAborted()
    const archive = await JSZip.loadAsync(bytes)
    const manifestFile = archive.file('manifest.json')
    if (!manifestFile) throw new Error('plugin archive does not contain manifest.json')
    const manifest: ArtifactManifest = parseArtifactManifest(
      JSON.parse(await manifestFile.async('text')),
    )
    if (this.options.compatibility) {
      assertPluginManifestCompatible(manifest, this.options.compatibility)
    }
    const files: Array<PluginArtifact['files'][number]> = []
    for (const entry of Object.values(archive.files)) {
      signal.throwIfAborted()
      if (entry.dir || entry.name === 'manifest.json') continue
      const path = safePluginPath(entry.name, `archive entry ${entry.name}`)
      files.push({ path, bytes: await entry.async('uint8array') })
    }
    const validated = await validateArtifact(
      { manifest, files },
      { platform: this.options.platform },
    )
    return {
      codecId: this.id,
      files: new Map(validated.files.map(item => [item.path, item.bytes])),
      manifest: validated.manifest,
    }
  }
}