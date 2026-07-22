import { db, type PluginArchiveDB } from '@delta-comic/db'
import { logger } from '@delta-comic/logger'
import {
  AwesomeRegistryClient,
  type AwesomeMarketplaceEntry,
  type AwesomeRegistryClientOptions,
  type AwesomeRegistryIndex,
} from '@delta-comic/plugin'
import { refDebounced } from '@vueuse/core'
import { computed, readonly, shallowRef } from 'vue'

import {
  filterPluginMarketplaceItems,
  mergePluginMarketplaceItems,
  type PluginMarketplaceFilter,
} from './model'

const marketplaceLogger = logger.scoped('app:plugin-marketplace')

export interface UsePluginMarketplaceOptions {
  client?: AwesomeRegistryClient
  clientOptions?: AwesomeRegistryClientOptions
  coreVersion: string
}

export const usePluginMarketplace = (options: UsePluginMarketplaceOptions) => {
  const client = options.client ?? new AwesomeRegistryClient(options.clientOptions)
  const index = shallowRef<AwesomeRegistryIndex>()
  const entries = shallowRef<AwesomeMarketplaceEntry[]>([])
  const installedPlugins = shallowRef<PluginArchiveDB.Archive[]>([])
  const nextPage = shallowRef<string | null>(null)
  const loading = shallowRef(false)
  const loadingMore = shallowRef(false)
  const stale = shallowRef(false)
  const error = shallowRef<Error>()
  const query = shallowRef('')
  const filter = shallowRef<PluginMarketplaceFilter>('all')
  const failedAction = shallowRef<'loadMore' | 'refresh'>('refresh')
  const debouncedQuery = refDebounced(query, 150)

  const items = computed(() =>
    mergePluginMarketplaceItems(entries.value, installedPlugins.value, options.coreVersion),
  )
  const visibleItems = computed(() =>
    filterPluginMarketplaceItems(items.value, debouncedQuery.value, filter.value),
  )
  const hasMore = computed(() => nextPage.value !== null)

  const refreshInstalled = async () => {
    installedPlugins.value = await db.selectFrom('plugin').selectAll().execute()
    marketplaceLogger.debug('installed plugin catalog refreshed', {
      count: installedPlugins.value.length,
    })
  }

  const loadEntries = async (path: string) => {
    const result = await client.loadPage(path)
    const pageEntries = await Promise.all(
      result.data.items.map(async listing => {
        if (!listing.release?.manifestUrl) return { listing }
        try {
          return { listing, manifest: await client.loadManifest(listing) }
        } catch (manifestError) {
          marketplaceLogger.warn(
            'marketplace manifest load failed',
            { plugin: listing.id },
            manifestError,
          )
          return {
            listing,
            manifestError:
              manifestError instanceof Error ? manifestError.message : String(manifestError),
          }
        }
      }),
    )
    return { entries: pageEntries, nextPage: result.data.pagination.next, stale: result.stale }
  }

  const refresh = async () => {
    if (loading.value || loadingMore.value) return
    loading.value = true
    marketplaceLogger.info('plugin marketplace refresh started')
    error.value = undefined
    try {
      const [indexResult] = await Promise.all([client.loadIndex(), refreshInstalled()])
      const firstPage = indexResult.data.pages[0]
      const loaded = firstPage ? await loadEntries(firstPage.path) : undefined
      index.value = indexResult.data
      entries.value = loaded?.entries ?? []
      nextPage.value = loaded?.nextPage ?? null
      stale.value = indexResult.stale || Boolean(loaded?.stale)
      marketplaceLogger.info('plugin marketplace refreshed', {
        entryCount: entries.value.length,
        stale: stale.value,
      })
    } catch (reason) {
      failedAction.value = 'refresh'
      error.value = reason instanceof Error ? reason : new Error(String(reason))
      marketplaceLogger.error('plugin marketplace refresh failed', error.value)
    } finally {
      loading.value = false
    }
  }

  const loadMore = async () => {
    const path = nextPage.value
    if (!path || loading.value || loadingMore.value) return
    loadingMore.value = true
    marketplaceLogger.debug('plugin marketplace page load started')
    error.value = undefined
    try {
      const loaded = await loadEntries(path)
      const knownIds = new Set(entries.value.map(entry => entry.listing.id))
      entries.value = entries.value.concat(
        loaded.entries.filter(entry => !knownIds.has(entry.listing.id)),
      )
      nextPage.value = loaded.nextPage
      stale.value ||= loaded.stale
      marketplaceLogger.info('plugin marketplace page loaded', {
        entryCount: loaded.entries.length,
        stale: loaded.stale,
      })
    } catch (reason) {
      failedAction.value = 'loadMore'
      error.value = reason instanceof Error ? reason : new Error(String(reason))
      marketplaceLogger.error('plugin marketplace page load failed', error.value)
    } finally {
      loadingMore.value = false
    }
  }

  const retry = () => (failedAction.value === 'loadMore' ? loadMore() : refresh())
  const setQuery = (value: string) => (query.value = value)
  const setFilter = (value: PluginMarketplaceFilter) => (filter.value = value)

  return {
    error: readonly(error),
    filter: readonly(filter),
    hasMore,
    index: readonly(index),
    items,
    loading: readonly(loading),
    loadingMore: readonly(loadingMore),
    query: readonly(query),
    stale: readonly(stale),
    visibleItems,
    loadMore,
    refresh,
    refreshInstalled,
    retry,
    setFilter,
    setQuery,
  }
}