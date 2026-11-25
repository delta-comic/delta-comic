import type { PluginManifest } from '@delta-comic/model'

export type PluginCatalogSource =
  | { readonly type: 'github'; readonly repository: string }
  | { readonly type: 'url'; readonly url: string }

export interface PluginCatalogRepository {
  readonly defaultBranch: string
  readonly lastCommitAt: string
  readonly name: string
  readonly owner: string
  readonly readmeUrl?: string
  readonly url: string
}

export interface PluginCatalogRelease {
  readonly manifestUrl: string | null
  readonly publishedAt: string
  readonly url: string
  readonly version: string
}

export interface PluginCatalogListing {
  readonly authors: readonly string[]
  readonly id: string
  readonly release?: PluginCatalogRelease
  readonly repository?: PluginCatalogRepository
  readonly source: PluginCatalogSource
}

export interface PluginCatalogPageReference {
  readonly items: number
  readonly page: number
  readonly path: string
}

export interface PluginCatalogIndex {
  readonly pageSize: number
  readonly pages: readonly PluginCatalogPageReference[]
  readonly totalItems: number
  readonly totalPages: number
}

export interface PluginCatalogPagination {
  readonly next: string | null
  readonly page: number
  readonly pageSize: number
  readonly previous: string | null
  readonly totalItems: number
  readonly totalPages: number
}

export interface PluginCatalogPage {
  readonly items: readonly PluginCatalogListing[]
  readonly pagination: PluginCatalogPagination
}

export interface PluginCatalogResult<T> {
  readonly cachedAt: string
  readonly data: T
  readonly stale: boolean
}

/** The narrow catalog port required by an install source resolver. */
export interface PluginInstallCatalog {
  resolveInstallInput(plugin: string, signal: AbortSignal): Promise<string>
}

/** Host-facing catalog operations used by the marketplace feature. */
export interface PluginCatalog extends PluginInstallCatalog {
  loadIndex(signal?: AbortSignal): Promise<PluginCatalogResult<PluginCatalogIndex>>
  loadManifest(
    listing: PluginCatalogListing,
    signal?: AbortSignal,
  ): Promise<PluginManifest | undefined>
  loadPage(path: string, signal?: AbortSignal): Promise<PluginCatalogResult<PluginCatalogPage>>
}

const catalogInstallInputPattern = /^ap:([A-Za-z0-9][A-Za-z0-9_-]{0,63})$/

export const pluginCatalogInstallInput = (plugin: string) => {
  const input = `ap:${plugin}`
  if (!catalogInstallInputPattern.test(input)) {
    throw new TypeError(`invalid plugin catalog id: ${plugin}`)
  }
  return input
}

export const pluginCatalogIdFromInstallInput = (input: unknown) =>
  typeof input === 'string' ? catalogInstallInputPattern.exec(input)?.[1] : undefined