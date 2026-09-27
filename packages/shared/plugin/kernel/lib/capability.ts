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

export interface CapabilityModule {
  readonly id: string
  activate(plugin: PluginConfig, context: ActivationContext): Promise<boolean>
}

export interface CapabilityDefinition<T extends PluginConfig = PluginConfig> {
  readonly id: string
  readonly select?: (plugin: T) => boolean
  readonly activate: (plugin: T, context: ActivationContext) => Promise<boolean>
}

export const defineCapability = <T extends PluginConfig>(definition: CapabilityDefinition<T>) =>
  definition

export class ActivationPipeline {
  readonly #modules: readonly CapabilityModule[]

  constructor(modules: readonly CapabilityModule[]) {
    if (modules.length === 0) throw new Error('At least one capability module is required')
    const ids = new Set<string>()
    for (const module of modules) {
      if (!module.id) throw new Error('Capability module id is required')
      if (!ids.add(module.id)) throw new Error(`Duplicate capability module: ${module.id}`)
    }
    this.#modules = modules
  }

  async activate(plugin: PluginConfig, context: ActivationContext) {
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