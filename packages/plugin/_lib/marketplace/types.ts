import type { PluginArchiveDB } from '@delta-comic/db'

export const AWESOME_REGISTRY_BASE_URL =
  'https://raw.githubusercontent.com/delta-comic/awesome-plugins/main/'
export const AWESOME_REGISTRY_INDEX_PATH = 'registry/index.json'
export const AWESOME_REGISTRY_SCHEMA_VERSION = 1 as const

export interface AwesomeRegistryPageReference {
  page: number
  items: number
  path: string
}

export interface AwesomeRegistryIndex {
  schemaVersion: typeof AWESOME_REGISTRY_SCHEMA_VERSION
  pageSize: number
  totalItems: number
  totalPages: number
  pages: AwesomeRegistryPageReference[]
}

export interface AwesomeRegistryPagination {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  previous: string | null
  next: string | null
}

export type AwesomePluginDownload =
  | { type: 'github'; repository: string }
  | { type: 'url'; url: string }

export interface AwesomePluginRepository {
  owner: string
  name: string
  url: string
  defaultBranch: string
  lastCommitAt: string
  readmeUrl?: string
}

export interface AwesomePluginRelease {
  version: string
  url: string
  publishedAt: string
  manifestUrl: string | null
}

export interface AwesomePluginListing {
  schemaVersion: typeof AWESOME_REGISTRY_SCHEMA_VERSION
  id: string
  authors: string[]
  download: AwesomePluginDownload
  repository?: AwesomePluginRepository
  release?: AwesomePluginRelease
}

export interface AwesomeRegistryPage {
  schemaVersion: typeof AWESOME_REGISTRY_SCHEMA_VERSION
  pagination: AwesomeRegistryPagination
  items: AwesomePluginListing[]
}

export interface AwesomeRegistryResult<T> {
  data: T
  cachedAt: string
  stale: boolean
}

export interface AwesomeMarketplaceEntry {
  listing: AwesomePluginListing
  manifest?: PluginArchiveDB.Meta
  manifestError?: string
}

export interface MarketplaceStorage {
  getItem(key: string): string | null
  removeItem(key: string): void
  setItem(key: string, value: string): void
}