import type { PluginArchiveDB } from '@delta-comic/db'
import { logger } from '@delta-comic/logger'
import ky from 'ky'

import { parsePluginManifest } from '../manifest'

import { AwesomeRegistryCache } from './cache'
import {
  AWESOME_REGISTRY_BASE_URL,
  AWESOME_REGISTRY_INDEX_PATH,
  type AwesomePluginListing,
  type AwesomeRegistryIndex,
  type AwesomeRegistryPage,
  type AwesomeRegistryResult,
  type MarketplaceStorage,
} from './types'
import {
  assertAwesomeRegistryPagePath,
  parseAwesomeRegistryIndex,
  parseAwesomeRegistryPage,
  AwesomeRegistryValidationError,
} from './validation'

const marketplaceLogger = logger.scoped('plugin:marketplace')

export interface AwesomeRegistryClientOptions {
  baseUrl?: string
  cache?: AwesomeRegistryCache
  requestJson?: (url: string) => Promise<unknown>
  storage?: MarketplaceStorage
}

const defaultRequestJson = async (url: string) =>
  await ky.get(url, { retry: 2, timeout: 30_000 }).json<unknown>()

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

export class AwesomeRegistryClient {
  private readonly baseUrl: string
  private readonly cache: AwesomeRegistryCache
  private readonly requestJson: (url: string) => Promise<unknown>

  public constructor(options: AwesomeRegistryClientOptions = {}) {
    this.baseUrl = new URL(options.baseUrl ?? AWESOME_REGISTRY_BASE_URL).href
    this.cache = options.cache ?? new AwesomeRegistryCache(options.storage ?? defaultStorage())
    this.requestJson = options.requestJson ?? defaultRequestJson
  }

  public async loadIndex(): Promise<AwesomeRegistryResult<AwesomeRegistryIndex>> {
    return await this.load(
      AWESOME_REGISTRY_INDEX_PATH,
      parseAwesomeRegistryIndex,
      () => this.cache.readIndex(),
      data => this.cache.writeIndex(data),
    )
  }

  public async loadPage(path: string): Promise<AwesomeRegistryResult<AwesomeRegistryPage>> {
    const safePath = assertAwesomeRegistryPagePath(path)
    return await this.load(
      safePath,
      parseAwesomeRegistryPage,
      () => this.cache.readPage(safePath),
      data => this.cache.writePage(safePath, data),
    )
  }

  public async findListing(id: string): Promise<AwesomePluginListing> {
    marketplaceLogger.debug('searching marketplace listing', { plugin: id })
    const { data: index } = await this.loadIndex()
    for (const pageReference of index.pages) {
      const { data: page } = await this.loadPage(pageReference.path)
      const listing = page.items.find(item => item.id === id)
      if (listing) {
        marketplaceLogger.debug('marketplace listing found', { plugin: id })
        return listing
      }
    }
    throw new Error(`Plugin "${id}" is not registered in awesome-plugins`)
  }

  public async loadManifest(
    listing: AwesomePluginListing,
  ): Promise<PluginArchiveDB.Meta | undefined> {
    const manifestUrl = listing.release?.manifestUrl
    if (!manifestUrl) return undefined
    const manifest = parsePluginManifest(await this.requestJson(manifestUrl))
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
  ): Promise<AwesomeRegistryResult<T>> {
    let payload: unknown
    try {
      payload = await this.requestJson(new URL(path, this.baseUrl).href)
    } catch (error) {
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