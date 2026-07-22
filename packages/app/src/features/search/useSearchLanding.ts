import { useNativeStore } from '@delta-comic/db'
import { logger } from '@delta-comic/logger'
import { Global, type Search, usePluginStore } from '@delta-comic/plugin'
import { SharedFunction } from '@delta-comic/utils'
import { computedAsync } from '@vueuse/core'
import { uniq } from 'es-toolkit'
import { computed, readonly, shallowRef } from 'vue'

import { pluginName } from '@/symbol'

const searchLogger = logger.scoped('app:search')

export interface ResolvedHotSearchSection {
  id: string
  items: Search.HotSearchItem[]
  plugin: string
  target: Search.HotSearchTarget
  title: string
}

interface ResolvedSearchTarget extends Search.HotSearchTarget {
  plugin: string
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
      const entry = Object.entries(config.search?.methods ?? {})[0]
      if (!entry) continue
      const [method, definition] = entry
      return { method, plugin, sort: definition.defaultSort }
    }
    return undefined
  })

  const hotSearchSections = computedAsync<ResolvedHotSearchSection[]>(
    async onCancel => {
      const providers = Array.from(Global.hotSearch.entries()).flatMap(([plugin, entries]) =>
        entries.map((provider, index) => ({ index, plugin, provider })),
      )
      const controller = new AbortController()
      onCancel(() => controller.abort())

      const sections = await Promise.all(
        providers.map(async ({ index, plugin, provider }) => {
          try {
            const items = await provider.fetchItems(controller.signal)
            return {
              id: `${plugin}:${index}`,
              items,
              plugin,
              target: provider.target,
              title: provider.title,
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
    target?: Search.HotSearchTarget,
  ): ResolvedSearchTarget | undefined {
    if (!plugin || !target) return fallbackTarget.value
    const method = pluginStore.plugins.get(plugin)?.search?.methods?.[target.method]
    if (!method) return fallbackTarget.value
    return { method: target.method, plugin, sort: target.sort ?? method.defaultSort }
  }

  async function submit(input = query.value, plugin?: string, target?: Search.HotSearchTarget) {
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

  function selectHotSearchItem(section: ResolvedHotSearchSection, item: Search.HotSearchItem) {
    const value = item.value ?? item.text
    query.value = value
    return submit(value, section.plugin, item.target ?? section.target)
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