import type { DCPluginConfig } from '../export'

import type { PluginScope } from './scope'

export interface ActivationStepUpdate {
  readonly description?: string
  readonly name?: string
}

export interface ActivationContext {
  readonly owner: string
  readonly scope: PluginScope
  readonly signal: AbortSignal
  report(update: ActivationStepUpdate | string): void
}

export interface CapabilityModule {
  readonly id: string
  activate(plugin: DCPluginConfig, context: ActivationContext): Promise<boolean>
}

export interface CapabilityDefinition<T> {
  readonly id: string
  select(plugin: DCPluginConfig): T | undefined
  activate(model: T, context: ActivationContext): Promise<void> | void
}

export const defineCapability = <T>(definition: CapabilityDefinition<T>): CapabilityModule => ({
  id: definition.id,
  async activate(plugin, context) {
    const model = definition.select(plugin)
    if (model === undefined) return false
    await definition.activate(model, context)
    return true
  },
})

export class ActivationPipeline {
  readonly #modules: readonly CapabilityModule[]

  public constructor(modules: readonly CapabilityModule[]) {
    const ids = new Set<string>()
    for (const module of modules) {
      if (!module.id) throw new Error('capability id cannot be empty')
      if (ids.has(module.id)) throw new Error(`duplicate capability "${module.id}"`)
      ids.add(module.id)
    }
    this.#modules = [...modules]
  }

  public async activate(plugin: DCPluginConfig, context: ActivationContext) {
    const activated: string[] = []
    for (const module of this.#modules) {
      if (context.signal.aborted) throw context.signal.reason
      if (await module.activate(plugin, context)) activated.push(module.id)
    }
    return activated
  }
}