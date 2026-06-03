import { isString } from 'es-toolkit'
import { sortBy } from 'es-toolkit/compat'
import { markRaw, type Ref } from 'vue'

import type { PluginConfig } from '@/plugin'

import type { PluginBooter } from './init/utils'
import type { PluginLoadingInfo } from './loader'
import { usePluginStore } from './store'

const rawBooters = import.meta.glob<PluginBooter>('./init/booter/*_*.ts', {
  eager: true,
  import: 'default',
})
export const booters = sortBy(Object.entries(rawBooters), ([fname]) =>
  // oxlint-disable-next-line no-useless-escape
  Number(fname.match(/[\d\.]+(?=_)/)?.[0]),
).map(v => v[1])

export const bootPlugin = async (
  cfg: PluginConfig,
  info: Ref<Record<string, PluginLoadingInfo>>,
) => {
  const { plugins } = usePluginStore()
  plugins.set(cfg.name, markRaw(cfg))

  const env: Record<any, any> = {}
  for (const booter of booters) {
    const msIndex = info.value[cfg.name].steps.length
    info.value[cfg.name].steps[msIndex] = { name: booter.name, description: '' }
    info.value[cfg.name].progress = { stepsIndex: msIndex, status: 'process' }
    await booter.call(
      cfg,
      meta => {
        if (isString(meta)) info.value[cfg.name].steps[msIndex].description = meta
        else {
          if (meta.description) info.value[cfg.name].steps[msIndex].description = meta.description
          if (meta.name) info.value[cfg.name].steps[msIndex].name = meta.name
        }
      },
      env,
    )
  }

  info.value[cfg.name].progress.status = 'done'

  console.log(`[plugin usePluginStore.$loadPlugin] plugin "${cfg.name}" load done`)
}