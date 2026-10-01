import type { PluginConfig } from '@delta-comic/plugin-api'

import type { PluginScope } from './scope'

export interface ActivationStepUpdate {
  readonly capability: string
  readonly state: 'started' | 'completed'
}

export interface ActivationContext {
  readonly owner: string
  readonly scope: PluginScope
  readonly signal: AbortSignal
  readonly report: (update: ActivationStepUpdate) => void
}

export interface CapabilityModule<TConfig extends PluginConfig = PluginConfig> {
  readonly id: string
  activate(plugin: TConfig, context: ActivationContext): Promise<boolean>
}

export interface CapabilityDefinition<
  TConfig extends PluginConfig = PluginConfig,
  TModel = unknown,
> {
  readonly id: string
  readonly select?: (plugin: TConfig) => TModel | undefined
  readonly activate: (model: TModel, context: ActivationContext) => boolean | Promise<boolean>
}

export const defineCapability = <TConfig extends PluginConfig, TModel>(
  definition: CapabilityDefinition<TConfig, TModel>,
): CapabilityModule<TConfig> => ({
  id: definition.id,
  async activate(plugin, context) {
    const model = definition.select?.(plugin)
    if (model === undefined) return false
    return await definition.activate(model, context)
  },
})

export class ActivationPipeline<TConfig extends PluginConfig = PluginConfig> {
  readonly #modules: readonly CapabilityModule<TConfig>[]

  constructor(modules: readonly CapabilityModule<TConfig>[]) {
    if (modules.length === 0) throw new Error('At least one capability module is required')
    const ids = new Set<string>()
    for (const module of modules) {
      if (!module.id) throw new Error('Capability module id is required')
      if (!ids.add(module.id)) throw new Error(`Duplicate capability module: ${module.id}`)
    }
    this.#modules = modules
  }

  async activate(plugin: TConfig, context: ActivationContext) {
    const activated: string[] = []
    for (const module of this.#modules) {
      if (context.signal.aborted) throw new DOMException('Activation aborted', 'AbortError')
      context.report({ capability: module.id, state: 'started' })
      if (await module.activate(plugin, context)) activated.push(module.id)
      context.report({ capability: module.id, state: 'completed' })
    }
    return activated
  }
}