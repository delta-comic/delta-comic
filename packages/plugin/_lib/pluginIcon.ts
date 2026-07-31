import { createPluginAssetUrl } from './driver/init/storage'
import { parsePluginIconReference } from './manifest'

/** Resolves persisted plugin icon metadata into a URL that an `<img>` can consume. */
export const resolvePluginIconUrl = async (
  pluginId: string | undefined,
  icon: string | undefined,
): Promise<string | undefined> => {
  if (icon === undefined) return undefined
  const reference = parsePluginIconReference(icon, 'plugin icon')
  if (reference.type === 'remote') return reference.url
  if (!pluginId) throw new Error('A plugin id is required to resolve a local plugin icon')
  return `${await createPluginAssetUrl(pluginId, reference.path)}${reference.fragment}`
}