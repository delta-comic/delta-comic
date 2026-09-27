import type { PluginManifest } from '@delta-comic/both'
import {
  validateArtifact,
  type ArtifactFile,
  type PluginArtifact,
} from '@delta-comic/both/artifact'

import type { PluginFileReplacement, PluginFileStore } from './contracts'

export interface CordisPluginArtifact extends PluginArtifact {
  readonly manifest: PluginManifest
}

export interface CordisArtifactModule {
  readonly manifest: PluginManifest
  readonly entry: unknown
  dispose(): void
}

const isPluginEntry = (value: unknown) =>
  typeof value === 'function' || (typeof value === 'object' && value !== null)

const isPluginSetEntry = (value: unknown): value is readonly unknown[] => Array.isArray(value)

const assertEntryType = (manifest: PluginManifest, entry: unknown) => {
  if (manifest.entryType === 'plugin' && !isPluginEntry(entry)) {
    throw new TypeError(`plugin artifact entry must export a Cordis plugin: ${manifest.id}`)
  }
  if (manifest.entryType === 'plugin-set' && !isPluginSetEntry(entry)) {
    throw new TypeError(`plugin artifact entry must export a Cordis plugin set: ${manifest.id}`)
  }
}

const createReplacement = async (
  files: PluginFileStore,
  plugin: string,
  validated: Awaited<ReturnType<typeof validateArtifact>>,
): Promise<PluginFileReplacement> => {
  return files.replace(
    plugin,
    new Map<string, Uint8Array>(
      validated.files.map((file: ArtifactFile) => [file.path, file.bytes]),
    ),
  )
}

/** Reads the shared Artifact protocol without changing the legacy factory loader. */
export class CordisArtifactModuleReader {
  public constructor(private readonly files: PluginFileStore) {}

  public async read(
    artifact: CordisPluginArtifact,
    signal = new AbortController().signal,
  ): Promise<CordisArtifactModule> {
    const validated = await validateArtifact(artifact)
    signal.throwIfAborted()
    const plugin = validated.manifest.id
    const replacement = await createReplacement(this.files, plugin, validated)

    try {
      await replacement.commit()
      signal.throwIfAborted()
      const url = await this.files.createModuleUrl(plugin, validated.manifest.entry)
      const module = (await import(/* @vite-ignore */ url)) as { default?: unknown }
      signal.throwIfAborted()
      const entry = module.default ?? module
      assertEntryType(validated.manifest, entry)
      return { entry, manifest: validated.manifest, dispose: () => this.files.release(plugin) }
    } catch (error) {
      this.files.release(plugin)
      await replacement.rollback()
      throw error
    }
  }
}