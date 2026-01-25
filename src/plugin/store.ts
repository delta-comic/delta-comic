import { type PluginConfig, type PluginConfigSearchMethod, _pluginExposes } from "delta-comic-core"
import { defineStore } from "pinia"
import { computed, reactive, type Raw } from "vue"
import { shallowReactive } from "vue"
import { db } from "@/db"
import { computedAsync } from "@vueuse/core"
export interface SavePluginBlob {
  key: string
  blob: Blob
}

export interface PluginData {
  key: string
  value: any
}


export type PluginLoadingMicroSteps = {
  steps: {
    name: string
    description: string
  }[]
  now: {
    stepsIndex: number
    status: 'process' | 'error' | 'finish' | 'wait'
    error?: Error
  }
}

const pluginNames = computedAsync(async () => Object.fromEntries((await db.value
  .selectFrom('plugin')
  .select(['pluginName', 'displayName'])
  .execute())
  .map(v => [v.pluginName, v.displayName] as const)), {})

export const usePluginStore = defineStore('plugin', helper => {
  const plugins = shallowReactive(new Map<string, Raw<PluginConfig>>())
  const pluginSteps = reactive<Record<string, PluginLoadingMicroSteps>>({})

  const allSearchSource = computed(() => Array.from(plugins.values()).filter(v => v.search?.methods).map(v => [v.name, Object.entries(v.search?.methods ?? {})] as [plugin: string, sources: [name: string, method: PluginConfigSearchMethod][]]))



  const $getPluginDisplayName = helper.action((key: string) =>
    pluginNames.value[key] || key
    , 'getPluginDisplayName')

  return { $getPluginDisplayName, plugins, allSearchSource, pluginSteps }
})
