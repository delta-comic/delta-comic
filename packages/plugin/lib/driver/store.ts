import { PluginArchiveDB } from '@delta-comic/db'
import { defineStore } from 'pinia'
import type { Raw } from 'vue'
import { shallowReactive } from 'vue'

import type { PluginConfig } from '@/plugin'

export const usePluginStore = defineStore('plugin', helper => {
  const plugins = shallowReactive(new Map<string, Raw<PluginConfig>>())

  const { data: pluginNames } = PluginArchiveDB.useQuery(db =>
    db
      .select(['pluginName', 'displayName'])
      .execute()
      .then(v => Object.fromEntries(v.map(v => [v.pluginName, v.displayName]))),
  )

  const $getI18nName = helper.action((key: string) => pluginNames.value[key] || key, 'getI18nName')

  return { $getI18nName, plugins }
})