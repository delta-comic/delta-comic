import type { PluginArchiveDB } from '@delta-comic/db'
import { logger } from '@delta-comic/logger'

import { builtInPluginRegistry } from '../features/registry'
import type { BuiltInPluginDefinition } from '../plugin'

const builtInLogger = logger.scoped('plugin:builtin')

export const BUILT_IN_PLUGIN_LOADER = 'builtin'

export const isBuiltInPluginName = (pluginName: string) => builtInPluginRegistry.has(pluginName)

export const isBuiltInPlugin = (plugin: Pick<PluginArchiveDB.Archive, 'loaderName'>): boolean =>
  plugin.loaderName === BUILT_IN_PLUGIN_LOADER

export const builtInDefinitionToArchive = (
  definition: BuiltInPluginDefinition,
  enable = definition.enabledByDefault ?? true,
): PluginArchiveDB.Archive => ({
  displayName: definition.meta.name.display,
  enable,
  installerName: BUILT_IN_PLUGIN_LOADER,
  installInput: '',
  loaderName: BUILT_IN_PLUGIN_LOADER,
  meta: definition.meta,
  pluginName: definition.meta.name.id,
})

/** Mirrors compile-time definitions into the plugin catalog while preserving their enable state. */
export const synchronizeBuiltInPlugins = async (): Promise<void> => {
  builtInLogger.info('built-in plugin synchronization started', {
    definitionCount: builtInPluginRegistry.size,
  })
  const { db } = await import('@delta-comic/db')
  await db.transaction().execute(async trx => {
    const existing = await trx.selectFrom('plugin').selectAll().execute()
    const existingByName = new Map(existing.map(plugin => [plugin.pluginName, plugin]))

    for (const [pluginName, definition] of builtInPluginRegistry) {
      const current = existingByName.get(pluginName)
      const archive = builtInDefinitionToArchive(definition, current?.enable)
      const values = { ...archive, meta: JSON.stringify(archive.meta) }
      if (current) {
        await trx.updateTable('plugin').set(values).where('pluginName', '=', pluginName).execute()
      } else {
        await trx.insertInto('plugin').values(values).execute()
      }
    }

    const currentNames = [...builtInPluginRegistry.keys()]
    let staleQuery = trx.deleteFrom('plugin').where('loaderName', '=', BUILT_IN_PLUGIN_LOADER)
    if (currentNames.length > 0) staleQuery = staleQuery.where('pluginName', 'not in', currentNames)
    await staleQuery.execute()
  })
  builtInLogger.info('built-in plugin synchronization completed')
}