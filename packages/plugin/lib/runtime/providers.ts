import type { PluginArchiveRepository, PluginModuleReader } from '../install'
import type { InternalPluginDefinition, PluginCandidate, PluginCandidateProvider } from '../kernel'

export interface InternalPluginPreferences {
  enabled(plugin: string, fallback: boolean): Promise<boolean>
}

export class InternalPluginCandidateProvider implements PluginCandidateProvider {
  public readonly id = 'internal'

  public constructor(
    private readonly definitions: readonly InternalPluginDefinition[],
    private readonly preferences: InternalPluginPreferences = {
      enabled: async (_plugin, fallback) => fallback,
    },
  ) {}

  public async list(signal: AbortSignal) {
    const candidates: PluginCandidate[] = []
    for (const definition of this.definitions) {
      if (signal.aborted) throw signal.reason
      candidates.push({
        enabled: await this.preferences.enabled(
          definition.manifest.name.id,
          definition.enabledByDefault ?? true,
        ),
        load: async () => ({ factory: definition.factory }),
        management: { canDisable: true, canUninstall: false, canUpdate: false },
        manifest: definition.manifest,
        origin: 'builtin',
      })
    }
    return candidates
  }
}

export class InstalledPluginCandidateProvider implements PluginCandidateProvider {
  public readonly id = 'installed'

  public constructor(
    private readonly repository: PluginArchiveRepository,
    private readonly reader: PluginModuleReader,
  ) {}

  public async list(signal: AbortSignal): Promise<PluginCandidate[]> {
    const archives = await this.repository.list()
    if (signal.aborted) throw signal.reason
    return archives.map(archive => ({
      enabled: archive.enable,
      load: async loadSignal =>
        await this.reader.read(archive.pluginName, archive.meta, loadSignal),
      management: { canDisable: true, canUninstall: true, canUpdate: true },
      manifest: archive.meta,
      origin: 'installed',
    }))
  }
}

export class CompositePluginCandidateProvider implements PluginCandidateProvider {
  public readonly id = 'composite'

  public constructor(private readonly providers: readonly PluginCandidateProvider[]) {}

  public async list(signal: AbortSignal) {
    const candidates = (
      await Promise.all(this.providers.map(provider => provider.list(signal)))
    ).flat()
    const owners = new Map<string, PluginCandidate>()
    for (const candidate of candidates) {
      const id = candidate.manifest.name.id
      const previous = owners.get(id)
      if (previous) {
        throw new Error(
          `duplicate plugin candidate "${id}" from ${previous.origin} and ${candidate.origin}`,
        )
      }
      owners.set(id, candidate)
    }
    return [...owners.values()]
  }
}