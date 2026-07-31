import type { PluginArchiveDB } from '@delta-comic/db'

export type ClientPluginKind = 'normal' | 'preboot'

export const pluginKind = (plugin: PluginArchiveDB.Archive): ClientPluginKind =>
  plugin.meta.kind ?? 'normal'

export const selectPluginsForPhase = (
  plugins: PluginArchiveDB.Archive[],
  kind: ClientPluginKind,
  startupPrebootNames: ReadonlySet<string> = new Set(
    plugins.filter(plugin => pluginKind(plugin) === 'preboot').map(plugin => plugin.pluginName),
  ),
  activePrebootNames: ReadonlySet<string> = startupPrebootNames,
): PluginArchiveDB.Archive[] => {
  const selected = plugins.filter(plugin =>
    kind === 'preboot'
      ? startupPrebootNames.has(plugin.pluginName)
      : !startupPrebootNames.has(plugin.pluginName),
  )
  if (kind === 'preboot') return selected

  return selected.map(plugin => ({
    ...plugin,
    meta: {
      ...plugin.meta,
      require: plugin.meta.require.filter(dependency => !activePrebootNames.has(dependency.id)),
    },
  }))
}

export const failedDependencies = (
  plugin: PluginArchiveDB.Archive,
  failedPluginNames: ReadonlySet<string>,
) => plugin.meta.require.filter(dependency => failedPluginNames.has(dependency.id)).map(v => v.id)

export const filterPluginsBySelection = (
  plugins: PluginArchiveDB.Archive[],
  pluginNames?: ReadonlySet<string>,
) => (pluginNames ? plugins.filter(plugin => pluginNames.has(plugin.pluginName)) : plugins)