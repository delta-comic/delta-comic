import { db } from '@delta-comic/db'
import { useGlobalVar } from '@delta-comic/utils'
import { computedAsync } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, reactive, type Raw } from 'vue'
import { shallowReactive } from 'vue'

import type { PluginConfig, Search } from '@/plugin'

export interface SavePluginBlob {
  key: string
  blob: Blob
}

export interface PluginData {
  key: string
  value: any
}

export type PluginLoadingMicroSteps = {
  steps: { name: string; description: string }[]
  now: { stepsIndex: number; status: 'process' | 'error' | 'finish' | 'wait'; error?: Error }
}

export const usePluginStore = useGlobalVar(
  defineStore('plugin', helper => {
    const plugins = shallowReactive(new Map<string, Raw<PluginConfig>>())
    const pluginSteps = reactive<Record<string, PluginLoadingMicroSteps>>({})

    const pluginNames = computedAsync(
      async () =>
        Object.fromEntries(
          (await db.value.selectFrom('plugin').select(['pluginName', 'displayName']).execute()).map(
            v => [v.pluginName, v.displayName] as const
          )
        ),
      {}
    )

    const allSearchSource = computed(() =>
      Array.from(plugins.values())
        .filter(v => v.search?.methods)
        .map(
          v =>
            [v.name, Object.entries(v.search?.methods ?? {})] as [
              plugin: string,
              sources: [name: string, method: Search.SearchMethod][]
            ]
        )
    )

    const $getPluginDisplayName = helper.action(
      (key: string) => pluginNames.value[key] || key,
      'getPluginDisplayName'
    )

    return { $getPluginDisplayName, plugins, allSearchSource, pluginSteps }
  }),
  'core/plugin/store'
)