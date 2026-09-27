import type { InternalPluginDefinition } from '../kernel'

export * from './core.builtin'

const builtinModules = import.meta.glob<{ default: InternalPluginDefinition }>('./*.builtin.ts', {
  eager: true,
})

/** Files are the registration boundary: adding a built-in does not change the composition root. */
export const internalPluginDefinitions = Object.entries(builtinModules)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([path, module]) => {
    if (!module.default)
      throw new Error(`built-in plugin module has no default definition: ${path}`)
    return module.default
  })