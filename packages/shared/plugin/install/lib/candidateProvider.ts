import type { PluginArchiveDB } from '@delta-comic/db'
import type { PluginCandidate, PluginCandidateProvider } from '@delta-comic/plugin-kernel'
import type { LoadedPluginModule } from '@delta-comic/plugin-loader'
import type { PluginManifest } from '@delta-comic/plugin-manifest'

import type { PluginArchiveRepository, PluginModuleReader } from './contracts'

const toRuntimeManifest = (manifest: PluginArchiveDB.Archive['meta']): PluginManifest => ({
  protocolVersion: 1,
  id: manifest.name.id,
  name: manifest.name.display,
  version: manifest.version.plugin,
  author: manifest.author,
  description: manifest.description,
  entry: 'index.js',
  entryType: 'plugin',
  dependencies: manifest.require.map(dependency => ({
    id: dependency.id,
    ...(dependency.download ? { version: dependency.download } : {}),
  })),
  resources: [],
})

const toRuntimeModule = (
  module: Awaited<ReturnType<PluginModuleReader['read']>>,
): LoadedPluginModule => ({
  factory: environment =>
    module.factory({ platform: environment.platform === 'tauri' ? 'tauri' : 'web' }),
  activate: module.activate,
  dispose: module.dispose,
})

/**
 * The persisted `enable` flag is stored in a `TEXT` column. `kysely-plugin-serialize` normally
 * restores booleans, but the value that reaches this boundary is only typed as `boolean` — not
 * guaranteed at runtime. Normalize it so a legacy string/number (`'false'`, `'0'`, `1`, ...) can
 * never be mistaken for `true` by the runtime's truthiness check.
 */
/** Normalize persisted archives into the same candidate protocol used by internal plugins. */
export class InstalledPluginCandidateProvider implements PluginCandidateProvider {
  public readonly id = 'installed'

  public constructor(
    private readonly repository: PluginArchiveRepository,
    private readonly readers: readonly PluginModuleReader[],
  ) {}

  public async list(signal: AbortSignal): Promise<PluginCandidate[]> {
    const archives = await this.repository.list()
    signal.throwIfAborted()
    return archives.map(archive => {
      const reader =
        this.readers.find(candidate => candidate.matches?.(archive)) ??
        this.readers.find(candidate => !candidate.matches) ??
        this.readers[0]
      if (!reader) throw new Error('no plugin module reader is configured')
      return {
        enabled: archive.enable,
        management: {
          canDisable: true,
          canUninstall: true,
          canUpdate: archive.installInput.length > 0,
        },
        manifest: toRuntimeManifest(archive.meta),
        origin: 'installed' as const,
        load: async loadSignal => toRuntimeModule(await reader.read(archive, loadSignal)),
      }
    })
  }
}