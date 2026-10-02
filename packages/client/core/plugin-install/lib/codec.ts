import { validateArtifact } from '@delta-comic/plugin-artifact'
import {
  assertPluginManifestCompatible,
  type PluginManifestCompatibility,
} from '@delta-comic/plugin-manifest'
import JSZip from 'jszip'

import type { DecodedPluginPackage, PluginPackageCodec } from './contracts'
import { parsePluginManifest, safePluginPath } from './manifest'

export interface ZipPackageCodecOptions {
  readonly compatibility?: PluginManifestCompatibility
  readonly platform?: string
}

export class ZipPackageCodec implements PluginPackageCodec {
  public readonly id = 'zip'

  public constructor(private readonly options: ZipPackageCodecOptions = {}) {}

  public matches(file: File) {
    return file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip'
  }

  public async decode(file: File, signal: AbortSignal): Promise<DecodedPluginPackage> {
    const bytes = new Uint8Array(await file.arrayBuffer())
    signal.throwIfAborted()
    const archive = await JSZip.loadAsync(bytes)
    const manifestFile = archive.file('manifest.json')
    if (!manifestFile) throw new Error('plugin archive does not contain manifest.json')
    const manifest = parsePluginManifest(JSON.parse(await manifestFile.async('text')))
    assertPluginManifestCompatible(manifest, this.options.compatibility ?? {})
    const files = new Map<string, Uint8Array>()
    for (const entry of Object.values(archive.files)) {
      signal.throwIfAborted()
      if (entry.dir) continue
      const path = safePluginPath(entry.name, `archive entry ${entry.name}`)
      if (files.has(path)) throw new Error(`duplicate archive entry: ${path}`)
      files.set(path, await entry.async('uint8array'))
    }
    await validateArtifact(
      { manifest, files: [...files].map(([path, bytes]) => ({ path, bytes })) },
      { platform: this.options.platform },
    )
    signal.throwIfAborted()
    return { codecId: this.id, files, manifest }
  }
}