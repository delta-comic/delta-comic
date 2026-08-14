import type { PluginCandidate, PluginCandidateProvider } from '../kernel'

import type { PluginArchiveRepository, PluginModuleReader } from './contracts'

/**
 * The persisted `enable` flag is stored in a `TEXT` column. `kysely-plugin-serialize` normally
 * restores booleans, but the value that reaches this boundary is only typed as `boolean` — not
 * guaranteed at runtime. Normalize it so a legacy string/number (`'false'`, `'0'`, `1`, ...) can
 * never be mistaken for `true` by the runtime's truthiness check.
 */
const toBoolean = (value: unknown): boolean =>
  value === true || value === 'true' || value === 1 || value === '1'

/** Normalize persisted archives into the same candidate protocol used by internal plugins. */
export class InstalledPluginCandidateProvider implements PluginCandidateProvider {
  public readonly id = 'installed'

  public constructor(
    private readonly repository: PluginArchiveRepository,
    private readonly reader: PluginModuleReader,
  ) {}

  public async list(signal: AbortSignal): Promise<PluginCandidate[]> {
    const archives = await this.repository.list()
    signal.throwIfAborted()
    return archives.map(archive => ({
      enabled: toBoolean(archive.enable),
      load: async loadSignal =>
        await this.reader.read(archive.pluginName, archive.meta, loadSignal),
      management: {
        canDisable: true,
        canUninstall: true,
        canUpdate: archive.installInput.length > 0,
      },
      manifest: archive.meta,
      origin: 'installed',
    }))
  }
}