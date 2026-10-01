import type { PluginConfig } from '@delta-comic/plugin-api'
import type { PluginCandidate } from '@delta-comic/plugin-kernel'
import { shallowReactive } from 'vue'

type PluginModel<TConfig extends PluginConfig> = NonNullable<TConfig['model']>

export class PluginStore<TConfig extends PluginConfig = PluginConfig> {
  private readonly candidateEntries = shallowReactive(new Map<string, PluginCandidate<TConfig>>())
  private readonly loadingEntries = shallowReactive(new Map<string, TConfig>())
  private readonly pluginEntries = shallowReactive(new Map<string, TConfig>())
  private readonly readyEntries = shallowReactive(new Set<string>())

  public constructor(private readonly translateText: (value: string) => string = value => value) {}

  public get candidates(): ReadonlyMap<string, PluginCandidate<TConfig>> {
    return this.candidateEntries
  }

  public get loading(): ReadonlyMap<string, TConfig> {
    return this.loadingEntries
  }

  public get plugins(): ReadonlyMap<string, TConfig> {
    return this.pluginEntries
  }

  public get ready(): ReadonlySet<string> {
    return this.readyEntries
  }

  public replaceCandidates(candidates: readonly PluginCandidate<TConfig>[]) {
    this.candidateEntries.clear()
    for (const candidate of candidates) {
      this.candidateEntries.set(candidate.manifest.id, candidate)
    }
  }

  public markLoading(plugin: string, config: TConfig) {
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
    return this.translateText(this.candidateEntries.get(plugin)?.manifest.name ?? plugin)
  }

  public modelEntries<K extends keyof PluginModel<TConfig>>(
    key: K,
  ): [string, Exclude<PluginModel<TConfig>[K], undefined>][] {
    return [...this.pluginEntries].flatMap(([plugin, config]) => {
      const model = config.model?.[key]
      return model === undefined ? [] : [[plugin, model]]
    })
  }
}