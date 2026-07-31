import { logger } from '@delta-comic/logger'
import { isString } from 'es-toolkit'
import { markRaw, type Ref } from 'vue'

import type { PluginConfig } from '@/plugin'

import { runtimeExtensions } from './extensions'
import type { PluginLoadingInfo } from './loader'
import { usePluginStore } from './store'

const pluginBooterLogger = logger.scoped('plugin:booter')

export const booters = runtimeExtensions.booters.values

export const bootPlugin = async (
  cfg: PluginConfig,
  info: Ref<Record<string, PluginLoadingInfo>>,
) => {
  const store = usePluginStore()
  store.$markLoading(cfg.name)

  try {
    store.plugins.set(cfg.name, markRaw(cfg))

    const env: Record<any, any> = {}
    for (const booter of booters) {
      const msIndex = info.value[cfg.name].steps.length
      info.value[cfg.name].steps[msIndex] = { name: booter.name, description: '' }
      info.value[cfg.name].progress = { stepsIndex: msIndex, status: 'process' }
      pluginBooterLogger.debug('plugin boot step started', { plugin: cfg.name, step: msIndex })
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
    store.$markReady(cfg.name)

    pluginBooterLogger.info('plugin boot pipeline completed', { plugin: cfg.name })
  } catch (error) {
    store.$markUnloaded(cfg.name)
    pluginBooterLogger.error('plugin boot pipeline failed', { plugin: cfg.name }, error)
    throw error
  }
}