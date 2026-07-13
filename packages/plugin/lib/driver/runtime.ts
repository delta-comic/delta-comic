import { db, type PluginArchiveDB } from '@delta-comic/db'
import { ref, type App, type Ref } from 'vue'

import { useConfig } from '@/config'
import { Global } from '@/global'
import { pluginI18n, pluginMessageKey } from '@/i18n'
import type { PluginConfig } from '@/plugin'

import { isBuiltInPlugin, synchronizeBuiltInPlugins } from './builtIn'
import { cleanupPlugin } from './cleanup'
import { isTauriRuntime, removePluginFiles } from './init/storage'
import { bootResolvedConfig, type PluginLoadingInfo, loadPluginConfig } from './loader'
import { formatPluginLoadPlanError, planPluginLoadOrder } from './loadPlan'
import {
  failedDependencies,
  filterPluginsBySelection,
  pluginKind,
  selectPluginsForPhase,
  type ClientPluginKind,
} from './runtimePlan'
import { pluginStore } from './store'

const recoveryKey = 'delta-comic:preboot-recovery'

export interface PrebootRecovery {
  failedAt: number
  plugins: string[]
  reason: string
}

export interface PluginRuntimeOperation {
  operation: Promise<void>
  progress: Ref<Record<string, PluginLoadingInfo>>
}

export interface LoadNormalOptions {
  pluginNames?: readonly string[]
}

type ActivePlugin = { config: PluginConfig; kind: ClientPluginKind }

const reasonText = (error: unknown) => (error instanceof Error ? error.message : String(error))

const createLoadingInfo = (): PluginLoadingInfo => ({
  progress: { status: 'wait', stepsIndex: 0 },
  steps: [
    {
      name: pluginMessageKey('plugin.runtime.steps.waiting.title'),
      description: pluginMessageKey('plugin.runtime.steps.waiting.description'),
    },
  ],
})

class PluginRuntime {
  private readonly active = new Map<string, ActivePlugin>()
  private readonly activePrebootNames = new Set<string>()
  private readonly prebootCleanups = new Map<string, () => Promise<void> | void>()
  private readonly preparedPreboot = new Map<string, PluginConfig>()
  private readonly startupPluginNames = new Set<string>()
  private readonly startupPrebootNames = new Set<string>()
  private builtInSynchronization?: Promise<void>
  private enabledPrebootNames: string[] = []
  private normalOperation?: Promise<void>
  private startupSnapshotReady = false
  private prebootActivated = false

  public get activeNormalPluginNames() {
    return [...this.active.entries()]
      .filter(([, plugin]) => plugin.kind === 'normal')
      .map(([name]) => name)
  }

  loadNormal(options: LoadNormalOptions = {}): PluginRuntimeOperation {
    if (this.normalOperation) throw new Error('normal plugins are already loading')
    if (this.preparedPreboot.size > 0 && !this.prebootActivated) {
      throw new Error('preboot plugins have not finished activating')
    }
    if ([...this.active.values()].some(plugin => plugin.kind === 'normal')) {
      throw new Error('normal plugins are already active; use reloadNormal()')
    }
    const progress = ref<Record<string, PluginLoadingInfo>>({})
    const operation = this.loadKind('normal', progress, options)
    this.trackNormalOperation(operation)
    return { operation, progress }
  }

  reloadNormal(options: LoadNormalOptions = {}): PluginRuntimeOperation {
    if (this.normalOperation) throw new Error('normal plugins are already loading')
    const progress = ref<Record<string, PluginLoadingInfo>>({})
    const operation = (async () => {
      const unloadErrors = await this.unloadKind('normal')
      await this.loadKind('normal', progress, options)
      if (unloadErrors.length > 0) {
        throw new AggregateError(unloadErrors, 'some plugins failed to unload cleanly')
      }
    })()
    this.trackNormalOperation(operation)
    return { operation, progress }
  }

  async preparePreboot(app: App): Promise<{ reloadRequired: boolean }> {
    await this.ensureBuiltInPlugins()
    await pluginStore.$refreshI18nNames()
    const allPlugins = await db.selectFrom('plugin').selectAll().execute()
    this.captureStartupSnapshot(allPlugins)
    const plugins = selectPluginsForPhase(
      allPlugins.filter(plugin => plugin.enable),
      'preboot',
      this.startupPrebootNames,
      this.activePrebootNames,
    )
    this.enabledPrebootNames = plugins.map(plugin => plugin.pluginName)
    if (plugins.length === 0) {
      this.prebootActivated = true
      return { reloadRequired: false }
    }

    try {
      const plan = planPluginLoadOrder(plugins)
      const planError = formatPluginLoadPlanError(plan)
      if (planError) throw new Error(planError)
      for (const level of plan.levels) {
        for (const archive of level) {
          await Global.withRegistrationOwner(archive.pluginName, async () => {
            const platform = isTauriRuntime() ? 'tauri' : 'web'
            const factory = await loadPluginConfig(archive)
            if (!factory)
              throw new Error(`plugin entry has no default export: ${archive.pluginName}`)
            const config = factory({ safe: true, platform })
            if (config.name !== archive.pluginName) {
              throw new Error(`plugin name mismatch: ${archive.pluginName} / ${config.name}`)
            }
            const configStore = useConfig()
            await Promise.all(
              (config.config ?? []).map(pointer => configStore.$registerConfig(pointer).ready),
            )
            const cleanup = await config.onPreboot?.({ app, platform, safe: true })
            if (cleanup) this.prebootCleanups.set(config.name, cleanup)
            this.preparedPreboot.set(config.name, config)
          })
        }
      }
      return { reloadRequired: false }
    } catch (error) {
      return await this.failPreboot(this.enabledPrebootNames, error)
    }
  }

  async activatePreboot(progress = ref<Record<string, PluginLoadingInfo>>({})) {
    if (this.prebootActivated) return { reloadRequired: false }
    try {
      for (const [name, config] of this.preparedPreboot) {
        await Global.withRegistrationOwner(name, async () => {
          await bootResolvedConfig(config, progress)
        })
        this.active.set(name, { config, kind: 'preboot' })
        this.activePrebootNames.add(name)
        this.preparedPreboot.delete(name)
      }
      this.preparedPreboot.clear()
      this.prebootActivated = true
      return { reloadRequired: false }
    } catch (error) {
      return await this.failPreboot(this.enabledPrebootNames, error)
    }
  }

  async uninstall(pluginName: string) {
    const archive = await db
      .selectFrom('plugin')
      .selectAll()
      .where('pluginName', '=', pluginName)
      .executeTakeFirst()
    if (!archive) return
    if (isBuiltInPlugin(archive)) {
      throw new Error(`built-in plugin "${pluginName}" cannot be uninstalled`)
    }

    const errors: unknown[] = []
    const active = this.active.get(pluginName)
    if (active) {
      errors.push(...(await this.unloadOne(pluginName, active, true)))
    } else {
      let config: PluginConfig | undefined
      try {
        await Global.withRegistrationOwner(pluginName, async () => {
          const factory = await loadPluginConfig(archive)
          config = factory?.({ safe: true, platform: isTauriRuntime() ? 'tauri' : 'web' })
          await config?.onUninstall?.()
        })
      } catch (error) {
        errors.push(error)
      }
      if (config) {
        try {
          cleanupPlugin(config)
        } catch (error) {
          errors.push(error)
        }
      } else {
        Global.removeOwnedRegistrations(pluginName)
      }
    }

    await removePluginFiles(pluginName)
    await db.deleteFrom('plugin').where('pluginName', '=', pluginName).execute()
    await pluginStore.$refreshI18nNames()
    pluginStore.$touch()
    if (errors.length > 0) {
      throw new AggregateError(errors, `plugin "${pluginName}" was removed with cleanup errors`)
    }
  }

  readRecovery(): PrebootRecovery | null {
    try {
      const value = globalThis.localStorage?.getItem(recoveryKey)
      if (!value) return null
      return JSON.parse(value) as PrebootRecovery
    } catch (error) {
      console.warn('[plugin runtime] failed to read preboot recovery', error)
      return null
    }
  }

  clearRecovery() {
    try {
      globalThis.localStorage?.removeItem(recoveryKey)
    } catch (error) {
      console.warn('[plugin runtime] failed to clear preboot recovery', error)
    }
  }

  private trackNormalOperation(operation: Promise<void>) {
    this.normalOperation = operation
    void operation.then(
      () => (this.normalOperation = undefined),
      () => (this.normalOperation = undefined),
    )
  }

  private ensureBuiltInPlugins() {
    return (this.builtInSynchronization ??= import('../features/core/runtime').then(
      async ({ registerCoreRuntimeExtensions }) => {
        registerCoreRuntimeExtensions()
        await synchronizeBuiltInPlugins()
      },
    ))
  }

  private captureStartupSnapshot(plugins: PluginArchiveDB.Archive[]) {
    if (!this.startupSnapshotReady) this.startupPrebootNames.clear()
    for (const plugin of plugins) {
      if (this.startupPluginNames.has(plugin.pluginName)) continue
      this.startupPluginNames.add(plugin.pluginName)
      if (pluginKind(plugin) === 'preboot') this.startupPrebootNames.add(plugin.pluginName)
    }
    this.startupSnapshotReady = true
  }

  private async loadKind(
    kind: 'normal',
    progress: Ref<Record<string, PluginLoadingInfo>>,
    options: LoadNormalOptions,
  ) {
    await this.ensureBuiltInPlugins()
    await pluginStore.$refreshI18nNames()
    const allPlugins = await db
      .selectFrom('plugin')
      .where('enable', 'is', true)
      .selectAll()
      .execute()
    this.captureStartupSnapshot(allPlugins)
    const plugins = filterPluginsBySelection(
      selectPluginsForPhase(allPlugins, kind, this.startupPrebootNames, this.activePrebootNames),
      options.pluginNames ? new Set(options.pluginNames) : undefined,
    )
    const plan = planPluginLoadOrder(plugins)
    const planError = formatPluginLoadPlanError(plan)
    if (planError) throw new Error(planError)

    const failed = new Set<string>()
    for (const level of plan.levels) {
      for (const archive of level) {
        const name = archive.pluginName
        progress.value[name] ??= createLoadingInfo()
        const blockedBy = failedDependencies(archive, failed)
        if (blockedBy.length > 0) {
          failed.add(name)
          progress.value[name].progress = {
            errorReason: pluginI18n.translate('plugin.runtime.errors.blockedDependencies', {
              plugins: blockedBy.join(', '),
            }),
            status: 'error',
            stepsIndex: 0,
          }
          continue
        }

        let config: PluginConfig | undefined
        try {
          await Global.withRegistrationOwner(name, async () => {
            const factory = await loadPluginConfig(archive)
            if (!factory) throw new Error(`plugin entry has no default export: ${name}`)
            config = factory({
              safe: globalThis.window?.$$safe$$ ?? true,
              platform: isTauriRuntime() ? 'tauri' : 'web',
            })
            if (config.name !== name) {
              throw new Error(`plugin name mismatch: ${name} / ${config.name}`)
            }
            await bootResolvedConfig(config, progress)
          })
          this.active.set(name, { config: config!, kind })
        } catch (error) {
          failed.add(name)
          if (config) {
            try {
              cleanupPlugin(config)
            } catch (cleanupError) {
              console.error(`[plugin runtime] rollback failed for ${name}`, cleanupError)
            }
          } else {
            Global.removeOwnedRegistrations(name)
          }
          const current = progress.value[name] ?? createLoadingInfo()
          progress.value[name] = {
            ...current,
            progress: { ...current.progress, errorReason: reasonText(error), status: 'error' },
          }
        }
      }
    }
  }

  private async unloadKind(kind: ClientPluginKind) {
    const entries = [...this.active.entries()].filter(([, active]) => active.kind === kind)
    const errors: unknown[] = []
    for (const [name, active] of entries.reverse()) {
      errors.push(...(await this.unloadOne(name, active, false)))
    }
    return errors
  }

  private async unloadOne(name: string, active: ActivePlugin, uninstall: boolean) {
    const errors: unknown[] = []
    const attempt = async (action: (() => Promise<void> | void) | undefined) => {
      if (!action) return
      try {
        await action()
      } catch (error) {
        errors.push(error)
      }
    }

    await attempt(active.config.onUnload?.bind(active.config))
    if (uninstall) await attempt(active.config.onUninstall?.bind(active.config))
    await attempt(this.prebootCleanups.get(name))
    try {
      cleanupPlugin(active.config)
    } catch (error) {
      errors.push(error)
    }
    this.prebootCleanups.delete(name)
    this.preparedPreboot.delete(name)
    this.active.delete(name)
    this.activePrebootNames.delete(name)
    return errors
  }

  private async failPreboot(pluginNames: string[], error: unknown) {
    const cleanupErrors: unknown[] = []
    cleanupErrors.push(...(await this.unloadKind('preboot')))
    for (const [name, config] of [...this.preparedPreboot.entries()].reverse()) {
      try {
        await this.prebootCleanups.get(name)?.()
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError)
      }
      try {
        cleanupPlugin(config)
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError)
      }
      this.prebootCleanups.delete(name)
    }
    this.preparedPreboot.clear()
    this.activePrebootNames.clear()

    let disabled = true
    try {
      if (pluginNames.length > 0) {
        await db
          .updateTable('plugin')
          .set({ enable: false })
          .where('pluginName', 'in', pluginNames)
          .execute()
      }
    } catch (disableError) {
      disabled = false
      cleanupErrors.push(disableError)
    }

    const reasons = [reasonText(error), ...cleanupErrors.map(reasonText)]
    const recovery: PrebootRecovery = {
      failedAt: Date.now(),
      plugins: pluginNames,
      reason: reasons.join('\n'),
    }
    try {
      globalThis.localStorage?.setItem(recoveryKey, JSON.stringify(recovery))
    } catch (storageError) {
      console.warn('[plugin runtime] failed to persist preboot recovery', storageError)
    }
    this.prebootActivated = true
    return { reloadRequired: disabled }
  }
}

export const pluginRuntime = new PluginRuntime()