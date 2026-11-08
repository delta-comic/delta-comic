import { useConfig as useDbConfig } from '@delta-comic/db'
import type { FormDefaultValue, FormResult } from '@delta-comic/model'
import { shallowReactive, type Ref } from 'vue'

import type { ConfigPointer, UnwrapConfigPointer } from '../api'

export type ConfigSave<T extends ConfigPointer = ConfigPointer> = {
  form: UnwrapConfigPointer<T>
  data: Ref<FormResult<T['config']>>
  name: string
  ready: Promise<void>
}

type StoredConfigSave = {
  data: Ref<Record<string, FormDefaultValue[keyof FormDefaultValue]>>
  form: ConfigPointer['config']
  name: string
  ready: Promise<void>
}

export type PluginConfigLoader = <T extends ConfigPointer>(pointer: T) => ConfigSave<T>

const loadDatabaseConfig: PluginConfigLoader = pointer => {
  const store = useDbConfig(pointer.pluginName, pointer.config)
  return { data: store, form: pointer.config, name: pointer.configName, ready: store.ready }
}

export class ConfigStore {
  private readonly entries = shallowReactive(new Map<symbol, StoredConfigSave>())
  private readonly pointers = new Map<string, ConfigPointer>()
  private readonly isSystemDark =
    globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false

  public constructor(private readonly loadConfig: PluginConfigLoader = loadDatabaseConfig) {}

  public get form(): ReadonlyMap<symbol, StoredConfigSave> {
    return this.entries
  }

  public get isDark() {
    const pointer = this.pointers.get('core')
    if (!pointer) return this.isSystemDark
    const mode = (this.load(pointer).data.value as { darkMode?: string }).darkMode
    if (mode === 'light') return false
    if (mode === 'dark') return true
    return this.isSystemDark
  }

  public load<T extends ConfigPointer>(pointer: T): ConfigSave<T> {
    const value = this.entries.get(pointer.key)
    if (!value) throw new Error(`not found config by plugin "${pointer.pluginName}"`)
    return value as ConfigSave<T>
  }

  public has(pointer: ConfigPointer) {
    return this.entries.has(pointer.key)
  }

  public register<T extends ConfigPointer>(pointer: T) {
    const registered = this.entries.get(pointer.key)
    const ownerPointer = this.pointers.get(pointer.pluginName)
    if (registered && ownerPointer === pointer) return registered as ConfigSave<T>
    if (ownerPointer) {
      throw new Error(`plugin "${pointer.pluginName}" can only register one config`)
    }

    const saved = this.loadConfig(pointer)
    this.entries.set(pointer.key, saved as StoredConfigSave)
    this.pointers.set(pointer.pluginName, pointer)
    return saved
  }

  public unregister(pointer: ConfigPointer) {
    if (this.pointers.get(pointer.pluginName) !== pointer) return
    this.pointers.delete(pointer.pluginName)
    this.entries.delete(pointer.key)
  }
}