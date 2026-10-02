import {
  parsePluginCatalogIndex,
  parsePluginRelease,
  type PluginCatalogEntry,
  type PluginCatalogIndex,
  type PluginRelease,
} from './release.js'
import type { PluginCatalogStore } from './releaseStore.js'

export interface PluginReleasePublisher {
  publish(release: PluginRelease, metadata: PluginReleaseMetadata): Promise<PluginCatalogIndex>
  yank(pluginId: string, version: string): Promise<PluginCatalogIndex>
}

export interface PluginReleaseMetadata {
  name: string
  description?: string
}

const catalogError = (message: string) => new Error(`Plugin release update failed: ${message}`)

const loadCatalog = async (store: PluginCatalogStore) => {
  const snapshot = store.loadSnapshot
    ? await store.loadSnapshot()
    : { index: await store.load(), version: undefined }
  return {
    version: snapshot.version,
    index: parsePluginCatalogIndex(
      snapshot.index ?? { protocolVersion: 1, generatedAt: new Date().toISOString(), entries: [] },
    ),
  }
}

const updateEntry = (
  entries: readonly PluginCatalogEntry[],
  pluginId: string,
  update: (entry: PluginCatalogEntry | undefined) => PluginCatalogEntry,
) => {
  const index = entries.findIndex(entry => entry.pluginId === pluginId)
  const current = index === -1 ? undefined : entries[index]
  const next = update(current)
  return index === -1
    ? [...entries, next]
    : entries.map((entry, entryIndex) => (entryIndex === index ? next : entry))
}

export const createPluginReleasePublisher = (
  store: PluginCatalogStore,
): PluginReleasePublisher => ({
  async publish(input, metadata) {
    const release = parsePluginRelease(input)
    if (!metadata.name.trim()) throw catalogError('plugin name is required')
    const { index: current, version } = await loadCatalog(store)
    const nextEntries = updateEntry(current.entries, release.pluginId, entry => {
      if (entry?.releases.some(item => item.version === release.version)) {
        throw catalogError(`release already exists: ${release.pluginId}@${release.version}`)
      }
      return {
        pluginId: release.pluginId,
        name: metadata.name,
        ...(metadata.description === undefined
          ? entry?.description === undefined
            ? {}
            : { description: entry.description }
          : { description: metadata.description }),
        releases: [...(entry?.releases ?? []), release],
      }
    })
    const next = parsePluginCatalogIndex({
      ...current,
      generatedAt: new Date().toISOString(),
      entries: nextEntries,
    })
    await store.save(next, version)
    return next
  },

  async yank(pluginId, version) {
    const { index: current, version: expectedVersion } = await loadCatalog(store)
    let changed = false
    const nextEntries = current.entries.map(entry => {
      if (entry.pluginId !== pluginId) return entry
      const releases = entry.releases.map(release => {
        if (release.version !== version) return release
        changed = true
        return { ...release, yanked: true }
      })
      return { ...entry, releases }
    })
    if (!changed) throw catalogError(`release not found: ${pluginId}@${version}`)
    const next = parsePluginCatalogIndex({
      ...current,
      generatedAt: new Date().toISOString(),
      entries: nextEntries,
    })
    await store.save(next, expectedVersion)
    return next
  },
})