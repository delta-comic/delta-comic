import { isString } from 'es-toolkit'
import { sortBy } from 'es-toolkit/compat'
import { markRaw } from 'vue'

import type { PluginConfig } from '@/plugin'

import type { PluginBooter } from './init/utils'
import { usePluginStore } from './store'

const rawBooters = import.meta.glob<PluginBooter>('./init/booter/*_*.ts', {
  eager: true,
  import: 'default'
})
export const booters = sortBy(Object.entries(rawBooters), ([fname]) =>
  Number(fname.match(/[\d\.]+(?=_)/)?.[0])
).map(v => v[1])

export const bootPlugin = async (cfg: PluginConfig) => {
  const { plugins, pluginSteps } = usePluginStore()
  plugins.set(cfg.name, markRaw(cfg))
  pluginSteps[cfg.name] = { steps: [], now: { stepsIndex: 0, status: 'wait' } }
  try {
    const env: Record<any, any> = {}
    for (const booter of booters) {
      const msIndex = pluginSteps[cfg.name].steps.length
      pluginSteps[cfg.name].steps[msIndex] = { name: booter.name, description: '' }
      pluginSteps[cfg.name].now.stepsIndex = msIndex
      pluginSteps[cfg.name].now.status = 'process'
      await booter.call(
        cfg,
        meta => {
          if (isString(meta)) pluginSteps[cfg.name].steps[msIndex].description = meta
          else {
            if (meta.description)
              pluginSteps[cfg.name].steps[msIndex].description = meta.description
            if (meta.name) pluginSteps[cfg.name].steps[msIndex].name = meta.name
          }
        },
        env
      )
    }
    pluginSteps[cfg.name].now.stepsIndex++ // undefined to hide
  } catch (error) {
    pluginSteps[cfg.name].now.status = 'error'
    pluginSteps[cfg.name].now.error = error as Error
    throw error
  }
  console.log(`[plugin usePluginStore.$loadPlugin] plugin "${cfg.name}" load done`)
}