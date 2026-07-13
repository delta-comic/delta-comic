import { useConfig as useDbConfig } from '@delta-comic/db'
import type { FormResult } from '@delta-comic/model'
import { computed, shallowReactive, type Ref } from 'vue'

import type { ConfigDescription, ConfigPointer } from './configPointer'
import { coreConfig } from './features/core/config'

export * from './configPointer'

export type ConfigSave<T> = {
  form: ConfigDescription
  data: Ref<T>
  name: string
  ready: Promise<void>
}

export class ConfigStore {
  public readonly form = shallowReactive(new Map<symbol, ConfigSave<any>>())
  private readonly darkMode = computed(() => {
    if (!this.$isExistConfig(coreConfig)) return this.isSystemDark
    const config = this.$load(coreConfig).data.value
    switch (config.darkMode) {
      case 'light':
        return false
      case 'dark':
        return true
      case 'system':
      default:
        return this.isSystemDark
    }
  })

  private readonly isSystemDark =
    globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false

  public get isDark() {
    return this.darkMode.value
  }

  public constructor() {
    // Core settings remain available when the built-in core runtime is disabled.
    this.$registerConfig(coreConfig)
  }

  public $load<T extends ConfigPointer>(pointer: T): ConfigSave<FormResult<T['config']>> {
    const value = this.form.get(pointer.key)
    if (!value) throw new Error(`not found config by plugin "${pointer.pluginName}"`)
    return value
  }

  public $loadApp() {
    return this.$load(coreConfig)
  }

  public $isExistConfig(pointer: ConfigPointer) {
    return this.form.has(pointer.key)
  }

  public $registerConfig(pointer: ConfigPointer) {
    const registered = this.form.get(pointer.key)
    if (registered) return registered

    const store = useDbConfig(pointer.pluginName, pointer.config)
    const saved: ConfigSave<any> = {
      form: pointer.config,
      data: store,
      name: pointer.configName,
      ready: (store as typeof store & { ready: Promise<void> }).ready,
    }
    this.form.set(pointer.key, saved)
    return saved
  }

  /** @deprecated Use `$registerConfig`. */
  public $resignerConfig(pointer: ConfigPointer) {
    return this.$registerConfig(pointer)
  }

  public $unregisterConfig(pointer: ConfigPointer) {
    this.form.delete(pointer.key)
  }
}

let configStore: ConfigStore | undefined
export const useConfig = () => (configStore ??= new ConfigStore())