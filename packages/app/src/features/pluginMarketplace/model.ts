import type { PluginArchiveDB } from '@delta-comic/db'
import {
  isPluginManifestCompatible,
  pluginCatalogInstallInput,
  type PluginCatalogListing,
  type PluginManifest,
} from '@delta-comic/plugin'
import semver from 'semver'

export type PluginMarketplaceFilter = 'all' | 'available' | 'installed' | 'updates'
export type PluginMarketplaceCompatibility = 'compatible' | 'incompatible' | 'unknown'

export interface PluginMarketplaceEntry {
  listing: PluginCatalogListing
  manifest?: PluginManifest
  manifestError?: string
}

export interface PluginMarketplaceItem extends PluginMarketplaceEntry {
  installed?: PluginArchiveDB.Archive
  compatibility: PluginMarketplaceCompatibility
  updateAvailable: boolean
}

const releaseVersion = (entry: PluginMarketplaceEntry) =>
  entry.manifest?.version.plugin ?? entry.listing.release?.version

export const mergePluginMarketplaceItems = (
  entries: PluginMarketplaceEntry[],
  installedPlugins: PluginArchiveDB.Archive[],
  coreVersion: string,
): PluginMarketplaceItem[] => {
  const installedById = new Map(installedPlugins.map(plugin => [plugin.pluginName, plugin]))
  return entries.map(entry => {
    const installed = installedById.get(entry.listing.id)
    const availableVersion = releaseVersion(entry)
    const updateAvailable = Boolean(
      installed &&
      availableVersion &&
      semver.valid(semver.coerce(availableVersion)) &&
      semver.valid(semver.coerce(installed.meta.version.plugin)) &&
      semver.gt(
        semver.coerce(availableVersion) as semver.SemVer,
        semver.coerce(installed.meta.version.plugin) as semver.SemVer,
      ),
    )
    return {
      ...entry,
      compatibility: entry.manifestError
        ? 'incompatible'
        : entry.manifest
          ? isPluginManifestCompatible(entry.manifest, coreVersion)
            ? 'compatible'
            : 'incompatible'
          : 'unknown',
      installed,
      updateAvailable,
    }
  })
}

export const pluginMarketplaceInstallInput = (listing: PluginCatalogListing) =>
  pluginCatalogInstallInput(listing.id)

export const pluginMarketplaceSourceUrl = (listing: PluginCatalogListing) =>
  listing.source.type === 'github'
    ? `https://github.com/${listing.source.repository}`
    : listing.source.url

export const filterPluginMarketplaceItems = (
  items: PluginMarketplaceItem[],
  query: string,
  filter: PluginMarketplaceFilter,
) => {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return items.filter(item => {
    if (filter === 'available' && item.installed) return false
    if (filter === 'installed' && !item.installed) return false
    if (filter === 'updates' && !item.updateAvailable) return false
    if (!normalizedQuery) return true
    return [
      item.listing.id,
      item.manifest?.name.display,
      item.manifest?.description,
      ...item.listing.authors,
    ].some(value => value?.toLocaleLowerCase().includes(normalizedQuery))
  })
}