import type { PluginArchiveDB } from '@delta-comic/db'
import type { PluginManifest } from '@delta-comic/model'

import type { LoadedPluginModule } from '../kernel'

export type PluginInstallInput = File | string

export interface ResolvedPluginSource {
  readonly file: File
  readonly installInput: string
  readonly resolverId: string
}

export interface PluginSourceResolver {
  readonly id: string
  matches(input: PluginInstallInput): boolean
  resolve(
    input: PluginInstallInput,
    signal: AbortSignal,
    report?: PluginInstallReporter,
  ): Promise<ResolvedPluginSource>
}

export interface DecodedPluginPackage {
  readonly codecId: string
  readonly files: ReadonlyMap<string, Uint8Array>
  readonly manifest: PluginManifest
}

export interface PluginPackageCodec {
  readonly id: string
  matches(file: File): boolean
  decode(file: File, signal: AbortSignal): Promise<DecodedPluginPackage>
}

export interface PluginFileReplacement {
  commit(): Promise<void>
  rollback(): Promise<void>
}

export interface PluginFileStore {
  replace(plugin: string, files: ReadonlyMap<string, Uint8Array>): Promise<PluginFileReplacement>
  remove(plugin: string): Promise<void>
  read(plugin: string, path: string): Promise<Uint8Array>
  createAssetUrl(plugin: string, path: string): Promise<string>
  createModuleUrl(plugin: string, path: string): Promise<string>
  release(plugin: string): void
}

export interface PluginArchiveRepository {
  find(plugin: string): Promise<PluginArchiveDB.Archive | undefined>
  list(): Promise<PluginArchiveDB.Archive[]>
  remove(plugin: string): Promise<void>
  upsert(archive: PluginArchiveDB.Archive): Promise<void>
}

export interface PluginModuleReader {
  read(plugin: string, manifest: PluginManifest, signal: AbortSignal): Promise<LoadedPluginModule>
}

export interface PluginInstallProgress {
  readonly description?: string
  readonly downloadedBytes?: number
  readonly phase: 'decode' | 'persist' | 'resolve'
  readonly progress?: number
  readonly totalBytes?: number
}

export type PluginInstallReporter = (progress: PluginInstallProgress) => void