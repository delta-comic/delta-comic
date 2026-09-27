import type { PluginCandidate, PluginCandidateProvider } from '@delta-comic/plugin-kernel'

import { toRuntimeCandidate } from '../composition/runtimeAdapter'

import type { PluginArchiveRepository, PluginModuleReader } from './contracts'

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
      return toRuntimeCandidate(archive, reader)
    })
  }
}