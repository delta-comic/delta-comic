import type { InternalPluginDefinition, PluginCandidate, PluginCandidateProvider } from '../kernel'

const defaultStorage = () => {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export interface InternalPluginPreferences {
  enabled(plugin: string, fallback: boolean): Promise<boolean>
  setEnabled(plugin: string, enabled: boolean): Promise<void>
}

export class LocalInternalPluginPreferences implements InternalPluginPreferences {
  public constructor(
    private readonly storage: Storage | undefined = defaultStorage(),
    private readonly prefix = 'delta-comic:internal-plugin:',
  ) {}

  public async enabled(plugin: string, fallback: boolean) {
    try {
      const value = this.storage?.getItem(`${this.prefix}${plugin}`)
      return value === null || value === undefined ? fallback : value === 'true'
    } catch {
      return fallback
    }
  }

  public async setEnabled(plugin: string, enabled: boolean) {
    try {
      this.storage?.setItem(`${this.prefix}${plugin}`, String(enabled))
    } catch {}
  }
}

export class InternalPluginCandidateProvider implements PluginCandidateProvider {
  public readonly id = 'internal'

  public constructor(
    private readonly definitions: readonly InternalPluginDefinition[],
    private readonly preferences: InternalPluginPreferences = new LocalInternalPluginPreferences(),
  ) {}

  public async list(signal: AbortSignal) {
    const candidates: PluginCandidate[] = []
    for (const definition of this.definitions) {
      if (signal.aborted) throw signal.reason
      candidates.push({
        enabled:
          definition.canDisable === false
            ? true
            : await this.preferences.enabled(
                definition.manifest.name.id,
                definition.enabledByDefault ?? true,
              ),
        load: async () => ({ factory: definition.factory }),
        management: {
          canDisable: definition.canDisable ?? true,
          canUninstall: false,
          canUpdate: false,
        },
        manifest: definition.manifest,
        origin: 'builtin',
      })
    }
    return candidates
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
        if (previous.origin === 'builtin' && candidate.origin === 'installed') continue
        if (previous.origin === 'installed' && candidate.origin === 'builtin') {
          owners.set(id, candidate)
          continue
        }
        throw new Error(
          `duplicate plugin candidate "${id}" from ${previous.origin} and ${candidate.origin}`,
        )
      }
      owners.set(id, candidate)
    }
    return [...owners.values()]
  }
}