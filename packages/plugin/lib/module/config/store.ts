import { useConfig as useDbConfig } from '@delta-comic/db'
import type { FormResult } from '@delta-comic/model'
import { shallowReactive, type Ref } from 'vue'

import type { ConfigPointer, UnwrapConfigPointer } from './pointer'

export type ConfigSave<T extends ConfigPointer = ConfigPointer> = {
  form: UnwrapConfigPointer<T>
  data: Ref<FormResult<T['config']>>
  name: string
  ready: Promise<void>
}

export type PluginConfigLoader = <T extends ConfigPointer>(pointer: T) => ConfigSave<T>

const loadDatabaseConfig: PluginConfigLoader = pointer => {
  const store = useDbConfig(pointer.pluginName, pointer.config)
  return { data: store as any, form: pointer.config, name: pointer.configName, ready: store.ready }
}

export class ConfigStore {
  public readonly form = shallowReactive(new Map<symbol, ConfigSave>())
  private readonly pointers = new Map<string, ConfigPointer>()
  // private readonly darkMode = computed(() => {
  //   if (!this.$isExistConfig(coreConfig)) return this.isSystemDark
  //   const config = this.$load(coreConfig).data.value
  //   switch (config.darkMode) {
  //     case 'light':
  //       return false
  //     case 'dark':
  //       return true
  //     case 'system':
  //     default:
  //       return this.isSystemDark
  //   }
  // })

  // private readonly isSystemDark =
  //   globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false

  // public get isDark() {
  //   return this.darkMode.value
  // }

  public constructor(private readonly loadConfig: PluginConfigLoader = loadDatabaseConfig) {}

  public $load<T extends ConfigPointer>(pointer: T): ConfigSave<T> {
    const value = this.form.get(pointer.key)
    if (!value) throw new Error(`not found config by plugin "${pointer.pluginName}"`)
    return value
  }

  public $isExist(pointer: ConfigPointer) {
    return this.form.has(pointer.key)
  }

  public $register<T extends ConfigPointer>(pointer: T) {
    const registered = this.form.get(pointer.key)
    const ownerPointer = this.pointers.get(pointer.pluginName)
    if (registered && ownerPointer === pointer) return registered as ConfigSave<T>
    if (ownerPointer) {
      throw new Error(`plugin "${pointer.pluginName}" can only register one config`)
    }

    const saved = this.loadConfig(pointer)
    this.form.set(pointer.key, saved)
    this.pointers.set(pointer.pluginName, pointer)
    return saved
  }

  public $unregister(pointer: ConfigPointer) {
    if (this.pointers.get(pointer.pluginName) !== pointer) return
    this.pointers.delete(pointer.pluginName)
    this.form.delete(pointer.key)
  }

  public register<T extends ConfigPointer>(pointer: T) {
    return this.$register(pointer)
  }

  public unregister(pointer: ConfigPointer) {
    this.$unregister(pointer)
  }
}

let configStore: ConfigStore | undefined
export const useConfig = () => (configStore ??= new ConfigStore())