import type { PluginCandidate, PluginCandidateProvider } from '../kernel'

import type { PluginArchiveRepository, PluginModuleReader } from './contracts'

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
      enabled: archive.enable,
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