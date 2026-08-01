import { logger } from '@delta-comic/logger'
import type { PluginManifest } from '@delta-comic/model'
import ky from 'ky'

import type {
  PluginCatalog,
  PluginCatalogIndex,
  PluginCatalogListing,
  PluginCatalogPage,
  PluginCatalogResult,
} from '../../install/catalog'
import { parsePluginManifest } from '../../install/manifest'

import { AwesomeRegistryCache } from './cache'
import {
  assertAwesomeRegistryPagePath,
  parseAwesomeRegistryIndex,
  parseAwesomeRegistryPage,
  AwesomeRegistryValidationError,
} from './schema'
import {
  AWESOME_REGISTRY_BASE_URL,
  AWESOME_REGISTRY_INDEX_PATH,
  type AwesomePluginListing,
  type AwesomeRegistryIndex,
  type AwesomeRegistryPage,
  type AwesomeRegistryResult,
  type AwesomeRegistryStorage,
} from './types'

const marketplaceLogger = logger.scoped('plugin:marketplace')

export interface AwesomeRegistryClientOptions {
  baseUrl?: string
  cache?: AwesomeRegistryCache
  requestJson?: (url: string, signal?: AbortSignal) => Promise<unknown>
  storage?: AwesomeRegistryStorage
}

const defaultRequestJson = async (url: string, signal?: AbortSignal) =>
  await ky.get(url, { retry: 2, signal, timeout: 30_000 }).json<unknown>()

const defaultStorage = () => {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export class AwesomeRegistryNetworkError extends Error {
  public constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'AwesomeRegistryNetworkError'
  }
}

const catalogIndex = (index: AwesomeRegistryIndex): PluginCatalogIndex => ({
  pageSize: index.pageSize,
  pages: index.pages,
  totalItems: index.totalItems,
  totalPages: index.totalPages,
})

const catalogListing = (listing: AwesomePluginListing): PluginCatalogListing => ({
  authors: listing.authors,
  id: listing.id,
  ...(listing.release ? { release: listing.release } : {}),
  ...(listing.repository ? { repository: listing.repository } : {}),
  source: listing.download,
})

const catalogPage = (page: AwesomeRegistryPage): PluginCatalogPage => ({
  items: page.items.map(catalogListing),
  pagination: page.pagination,
})

export class AwesomeRegistryClient implements PluginCatalog {
  private readonly baseUrl: string
  private readonly cache: AwesomeRegistryCache
  private readonly requestJson: (url: string, signal?: AbortSignal) => Promise<unknown>

  public constructor(options: AwesomeRegistryClientOptions = {}) {
    this.baseUrl = new URL(options.baseUrl ?? AWESOME_REGISTRY_BASE_URL).href
    this.cache = options.cache ?? new AwesomeRegistryCache(options.storage ?? defaultStorage())
    this.requestJson = options.requestJson ?? defaultRequestJson
  }

  public async loadIndex(signal?: AbortSignal): Promise<PluginCatalogResult<PluginCatalogIndex>> {
    const result = await this.load(
      AWESOME_REGISTRY_INDEX_PATH,
      parseAwesomeRegistryIndex,
      () => this.cache.readIndex(),
      data => this.cache.writeIndex(data),
      signal,
    )
    return { ...result, data: catalogIndex(result.data) }
  }

  public async loadPage(
    path: string,
    signal?: AbortSignal,
  ): Promise<PluginCatalogResult<PluginCatalogPage>> {
    const safePath = assertAwesomeRegistryPagePath(path)
    const result = await this.load(
      safePath,
      parseAwesomeRegistryPage,
      () => this.cache.readPage(safePath),
      data => this.cache.writePage(safePath, data),
      signal,
    )
    return { ...result, data: catalogPage(result.data) }
  }

  public async resolveInstallInput(id: string, signal: AbortSignal) {
    const listing = await this.findListing(id, signal)
    return listing.source.type === 'github' ? `gh:${listing.source.repository}` : listing.source.url
  }

  public async findListing(id: string, signal?: AbortSignal): Promise<PluginCatalogListing> {
    marketplaceLogger.debug('searching marketplace listing', { plugin: id })
    const { data: index } = await this.loadIndex(signal)
    for (const pageReference of index.pages) {
      const { data: page } = await this.loadPage(pageReference.path, signal)
      const listing = page.items.find(item => item.id === id)
      if (listing) {
        marketplaceLogger.debug('marketplace listing found', { plugin: id })
        return listing
      }
    }
    throw new Error(`Plugin "${id}" is not registered in awesome-plugins`)
  }

  public async loadManifest(
    listing: PluginCatalogListing,
    signal?: AbortSignal,
  ): Promise<PluginManifest | undefined> {
    const manifestUrl = listing.release?.manifestUrl
    if (!manifestUrl) return undefined
    const manifest = parsePluginManifest(await this.requestJson(manifestUrl, signal))
    if (manifest.name.id !== listing.id) {
      throw new AwesomeRegistryValidationError(
        `listing ${listing.id} points to manifest for ${manifest.name.id}`,
      )
    }
    return manifest
  }

  private async load<T>(
    path: string,
    parse: (value: unknown) => T,
    readCache: () => { data: T; cachedAt: string } | undefined,
    writeCache: (data: T) => string,
    signal?: AbortSignal,
  ): Promise<AwesomeRegistryResult<T>> {
    let payload: unknown
    try {
      payload = await this.requestJson(new URL(path, this.baseUrl).href, signal)
    } catch (error) {
      if (signal?.aborted) throw signal.reason
      if (error instanceof AwesomeRegistryValidationError || error instanceof SyntaxError)
        throw error
      const cached = readCache()
      if (cached) {
        marketplaceLogger.warn('marketplace request failed; using stale cache', { path }, error)
        return { ...cached, stale: true }
      }
      marketplaceLogger.error('marketplace request failed without cache', { path }, error)
      throw new AwesomeRegistryNetworkError(`Failed to request awesome-plugins ${path}`, error)
    }
    const data = parse(payload)
    marketplaceLogger.debug('marketplace response cached', { path })
    return { cachedAt: writeCache(data), data, stale: false }
  }
}