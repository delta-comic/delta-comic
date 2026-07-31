import type { BuiltInPluginDefinition } from '../plugin'

const rawDefinitions = import.meta.glob<BuiltInPluginDefinition>('./*/feature.ts', {
  eager: true,
  import: 'default',
})

export const createBuiltInPluginRegistry = (
  definitions: readonly BuiltInPluginDefinition[],
): ReadonlyMap<string, BuiltInPluginDefinition> => {
  const registry = new Map<string, BuiltInPluginDefinition>()
  for (const definition of definitions) {
    const pluginName = definition.meta.name.id
    if (!pluginName) throw new Error('built-in plugin id cannot be empty')
    if (registry.has(pluginName)) throw new Error(`duplicate built-in plugin: ${pluginName}`)
    registry.set(pluginName, definition)
  }
  return registry
}

export const builtInPluginRegistry = createBuiltInPluginRegistry(Object.values(rawDefinitions))