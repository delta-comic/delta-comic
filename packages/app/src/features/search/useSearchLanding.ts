import { useNativeStore } from '@delta-comic/db'
import { logger } from '@delta-comic/logger'
import { type Content, usePluginStore } from '@delta-comic/plugin'
import { SharedFunction } from '@delta-comic/utils'
import { computedAsync } from '@vueuse/core'
import { uniq } from 'es-toolkit'
import { computed, readonly, shallowRef } from 'vue'

import { pluginName } from '@/symbol'

const searchLogger = logger.scoped('app:search')

export interface ResolvedHotSearchSection {
  id: string
  items: Content.SearchAim[]
  plugin: string
  title: string
}

interface ResolvedSearchTarget {
  method: string
  plugin: string
  sort?: string
}

interface UseSearchLandingOptions {
  onMissingTarget: () => void
}

export function useSearchLanding(options: UseSearchLandingOptions) {
  const pluginStore = usePluginStore()
  const query = shallowRef('')
  const history = useNativeStore(pluginName, 'search.history', new Array<string>())
  const isLoadingHotSearch = shallowRef(false)

  const fallbackTarget = computed<ResolvedSearchTarget | undefined>(() => {
    for (const [plugin, config] of pluginStore.plugins) {
      const method = config.model?.content?.search?.methods[0]
      if (!method) continue
      return { method: method.id, plugin, sort: method.sorts.default }
    }
    return undefined
  })

  const hotSearchSections = computedAsync<ResolvedHotSearchSection[]>(
    async onCancel => {
      const providers = pluginStore
        .modelEntries('content')
        .flatMap(([plugin, content]) =>
          content.search?.getHotSearch ? [{ plugin, provider: content.search.getHotSearch }] : [],
        )
      const controller = new AbortController()
      onCancel(() => controller.abort())

      const sections = await Promise.all(
        providers.map(async ({ plugin, provider }, index) => {
          try {
            const items = await provider(controller.signal)
            return {
              id: `${plugin}:${index}`,
              items,
              plugin,
              title: pluginStore.displayName(plugin),
            } satisfies ResolvedHotSearchSection
          } catch (error) {
            if (!controller.signal.aborted)
              searchLogger.warn('hot-search provider failed', { plugin }, error)
            return undefined
          }
        }),
      )
      return sections.filter(section => section !== undefined)
    },
    [],
    isLoadingHotSearch,
  )

  function resolveTarget(
    plugin?: string,
    target?: Content.SearchAim['search'],
  ): ResolvedSearchTarget | undefined {
    if (!plugin || !target) return fallbackTarget.value
    const method = pluginStore.plugins
      .get(plugin)
      ?.model?.content?.search?.methods.find(value => value.id === target.method)
    if (!method) return fallbackTarget.value
    return { method: target.method, plugin, sort: target.sort ?? method.sorts.default }
  }

  async function submit(
    input = query.value,
    plugin?: string,
    target?: Content.SearchAim['search'],
  ) {
    const normalized = input.trim()
    if (!normalized) return false
    const resolvedTarget = resolveTarget(plugin, target)
    if (!resolvedTarget) {
      options.onMissingTarget()
      return false
    }

    query.value = normalized
    history.value = uniq([normalized, ...history.value]).slice(0, 20)
    await SharedFunction.call(
      'routeToSearch',
      normalized,
      [resolvedTarget.plugin, resolvedTarget.method],
      resolvedTarget.sort,
    )
    return true
  }

  function selectHotSearchItem(section: ResolvedHotSearchSection, item: Content.SearchAim) {
    const value = item.input
    query.value = value
    return submit(value, section.plugin, item.search)
  }

  function clearHistory() {
    history.value = []
  }

  return {
    clearHistory,
    history: readonly(history),
    hotSearchSections,
    isLoadingHotSearch: readonly(isLoadingHotSearch),
    query,
    selectHotSearchItem,
    submit,
  }
}