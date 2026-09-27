import { shallowReactive, type Raw } from 'vue'

import type { DCPluginConfig } from '../api'
import type { PluginCandidate } from '../kernel'

export class PluginStore {
  private readonly candidateEntries = shallowReactive(new Map<string, PluginCandidate>())
  private readonly loadingEntries = shallowReactive(new Map<string, Raw<DCPluginConfig>>())
  private readonly pluginEntries = shallowReactive(new Map<string, Raw<DCPluginConfig>>())
  private readonly readyEntries = shallowReactive(new Set<string>())

  public constructor(private readonly translateText: (value: string) => string = value => value) {}

  public get candidates(): ReadonlyMap<string, PluginCandidate> {
    return this.candidateEntries
  }

  public get loading(): ReadonlyMap<string, Raw<DCPluginConfig>> {
    return this.loadingEntries
  }

  public get plugins(): ReadonlyMap<string, Raw<DCPluginConfig>> {
    return this.pluginEntries
  }

  public get ready(): ReadonlySet<string> {
    return this.readyEntries
  }

  public replaceCandidates(candidates: readonly PluginCandidate[]) {
    this.candidateEntries.clear()
    for (const candidate of candidates) {
      this.candidateEntries.set(candidate.manifest.name.id, candidate)
    }
  }

  public markLoading(plugin: string, config: Raw<DCPluginConfig>) {
    this.readyEntries.delete(plugin)
    this.loadingEntries.set(plugin, config)
    this.pluginEntries.delete(plugin)
  }

  public markReady(plugin: string) {
    const config = this.loadingEntries.get(plugin)
    if (!config) throw new Error(`plugin "${plugin}" was not marked as loading`)
    this.loadingEntries.delete(plugin)
    this.pluginEntries.set(plugin, config)
    this.readyEntries.add(plugin)
  }

  public markUnloaded(plugin: string) {
    this.readyEntries.delete(plugin)
    this.loadingEntries.delete(plugin)
    this.pluginEntries.delete(plugin)
  }

  public isLoaded(plugin: string) {
    return this.readyEntries.has(plugin)
  }

  public displayName(plugin: string) {
    return this.translateText(this.candidateEntries.get(plugin)?.manifest.name.display ?? plugin)
  }

  public modelEntries<K extends keyof NonNullable<DCPluginConfig['model']>>(key: K) {
    type Model = NonNullable<NonNullable<DCPluginConfig['model']>[K]>
    return [...this.pluginEntries].flatMap(([plugin, config]) => {
      const model = config.model?.[key]
      return model === undefined ? [] : ([[plugin, model]] as [string, Model][])
    })
  }
}