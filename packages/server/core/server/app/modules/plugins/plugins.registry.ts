import type { ServerPluginDefinition } from '../../../lib/plugin'

import { staticServerPluginDefinitions } from './definitions'
import { validateServerPluginDefinition } from './plugins.manifest'

export const createStaticServerPluginRegistry = (
  definitions: readonly unknown[],
): ReadonlyMap<string, ServerPluginDefinition> => {
  const registry = new Map<string, ServerPluginDefinition>()
  for (const rawDefinition of definitions) {
    const definition = validateServerPluginDefinition(rawDefinition)
    if (registry.has(definition.manifest.id)) {
      throw new Error(`duplicate static server plugin: ${definition.manifest.id}`)
    }
    registry.set(definition.manifest.id, definition)
  }
  return registry
}

export const staticServerPluginRegistry = createStaticServerPluginRegistry(
  staticServerPluginDefinitions,
)