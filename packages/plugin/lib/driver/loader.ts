import type { PluginArchiveDB } from '@delta-comic/db'
import { Mutex } from 'es-toolkit'
import type { Ref } from 'vue'

import { builtInPluginRegistry } from '@/features/registry'
import { pluginI18n, pluginMessageKey } from '@/i18n'
import type { PluginConfig, PluginConfigFactory } from '@/plugin'

import { bootPlugin } from './booter'
import { isBuiltInPlugin } from './builtIn'
import { cleanupPlugin } from './cleanup'
import { runtimeExtensions } from './extensions'
import { isTauriRuntime } from './init/storage'

export const loaders = runtimeExtensions.loaders.values

const loadLocks = <Record<string, Mutex>>{}
const getLoadLock = (pluginName: string) => (loadLocks[pluginName] ??= new Mutex())

export type PluginBootRollback = (
  config: PluginConfig | undefined,
  expectedName: string | undefined,
) => Promise<void> | void

export interface BootConfigOptions {
  expectedName?: string
  rollback?: PluginBootRollback
}

export const createPluginLoadingInfo = (): PluginLoadingInfo => ({
  progress: { status: 'wait', stepsIndex: 0 },
  steps: [
    {
      name: pluginMessageKey('plugin.runtime.steps.waiting.title'),
      description: pluginMessageKey('plugin.runtime.steps.waiting.description'),
    },
  ],
})

export const ensurePluginLoadingInfo = (
  info: Ref<Record<string, PluginLoadingInfo>>,
  pluginName: string,
) => (info.value[pluginName] ??= createPluginLoadingInfo())

export const markPluginLoadError = (
  info: Ref<Record<string, PluginLoadingInfo>>,
  pluginName: string,
  error: unknown,
) => {
  const loadingInfo = ensurePluginLoadingInfo(info, pluginName)
  loadingInfo.progress = {
    ...loadingInfo.progress,
    errorReason: error instanceof Error ? error.message : String(error),
    status: 'error',
  }
}

/** 解析 config factory 并启动插件；任何中途失败都保留原始错误并执行回滚。 */
export const bootConfig = async (
  configFactory: PluginConfigFactory,
  info: Ref<Record<string, PluginLoadingInfo>>,
  options: BootConfigOptions = {},
) => {
  const { expectedName, rollback } = options
  if (expectedName) ensurePluginLoadingInfo(info, expectedName)

  let cfg: PluginConfig | undefined
  try {
    cfg = configFactory({ safe: true, platform: isTauriRuntime() ? 'tauri' : 'web' })
    if (expectedName && cfg.name !== expectedName) {
      throw new Error(`plugin name mismatch: ${expectedName} / ${cfg.name}`)
    }
    await bootResolvedConfig(cfg, info)
    return cfg
  } catch (error) {
    const progressName = expectedName ?? cfg?.name
    if (progressName) markPluginLoadError(info, progressName, error)
    if (rollback) {
      try {
        await rollback(cfg, expectedName)
      } catch (rollbackError) {
        console.error('[plugin bootConfig] rollback failed', rollbackError)
      }
    }
    throw error
  }
}

export const bootResolvedConfig = async (
  cfg: ReturnType<PluginConfigFactory>,
  info: Ref<Record<string, PluginLoadingInfo>>,
) => {
  ensurePluginLoadingInfo(info, cfg.name)
  await bootPlugin(cfg, info)
}

export const loadPluginConfig = async (meta: PluginArchiveDB.Archive) => {
  const lock = getLoadLock(meta.pluginName)
  try {
    await lock.acquire()
    if (isBuiltInPlugin(meta)) return builtInPluginRegistry.get(meta.pluginName)?.config
    const loader = loaders.find(value => value.name === meta.loaderName)
    if (!loader) {
      throw new Error(
        pluginI18n.translate('plugin.runtime.errors.loaderMissing', {
          loader: meta.loaderName,
          plugin: meta.pluginName,
        }),
      )
    }
    return await loader.load(meta)
  } finally {
    lock.release()
  }
}

export const loadPlugin = async (
  meta: PluginArchiveDB.Archive,
  info: Ref<Record<string, PluginLoadingInfo>>,
) => {
  console.log(`[plugin bootPlugin] booting name "${meta.pluginName}"`)
  ensurePluginLoadingInfo(info, meta.pluginName)
  try {
    const configFactory = await loadPluginConfig(meta)
    if (!configFactory) {
      throw new Error(
        pluginI18n.translate('plugin.runtime.errors.defaultExportMissing', {
          plugin: meta.pluginName,
        }),
      )
    }
    await bootConfig(configFactory, info, {
      expectedName: meta.pluginName,
      rollback: config => cleanupPlugin(config ?? ({ name: meta.pluginName } as PluginConfig)),
    })
    console.log(`[plugin bootPlugin] boot name done "${meta.pluginName}"`)
  } catch (error) {
    markPluginLoadError(info, meta.pluginName, error)
    throw error
  }
}

export type PluginLoadingInfo = {
  steps: { name: string; description: string }[]
  progress: {
    errorReason?: string
    stepsIndex: number
    status: 'wait' | 'process' | 'error' | 'done'
  }
}

export const loadAllPlugins = () =>
  import('./runtime').then(({ pluginRuntime }) => pluginRuntime.loadNormal())