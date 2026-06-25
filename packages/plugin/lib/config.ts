import { useConfig as useDbConfig } from '@delta-comic/db'
import type { FormResult, FormSingleConfigure } from '@delta-comic/model'
import { defineStore } from 'pinia'
import { computed, shallowReactive, type Ref } from 'vue'

export type ConfigDescription = Record<
  string,
  Required<Pick<FormSingleConfigure, 'defaultValue'>> & FormSingleConfigure
>
export class ConfigPointer<T extends ConfigDescription = ConfigDescription> {
  constructor(
    public pluginName: string,
    public config: T,
    public configName: string,
  ) {
    this.key = Symbol.for(`config:${pluginName}`)
  }
  public readonly key: symbol
}

const appConfig = new ConfigPointer(
  'core',
  {
    recordHistory: { type: 'switch', defaultValue: true, info: '记录历史记录' },
    showAIProject: { type: 'switch', defaultValue: true, info: '展示AI作品' },
    darkMode: {
      type: 'radio',
      defaultValue: 'system',
      info: '暗色模式配置',
      comp: 'select',
      selects: [
        { label: '浅色', value: 'light' },
        { label: '暗色', value: 'dark' },
        { label: '跟随系统', value: 'system' },
      ],
    },
    easilyTitle: { type: 'switch', defaultValue: false, info: '简化标题(实验性功能)' },
    githubToken: {
      type: 'string',
      defaultValue: '',
      info: 'github的token',
      placeholder: '仅用于解除api访问限制',
    },
    receivePerReleaseUpdate: {
      type: 'switch',
      defaultValue: false,
      info: '接受预发布版本更新(可能不稳定)',
    },
    installOverride: { type: 'pairs', defaultValue: [], info: '安装源覆盖配置', required: true },
  },
  '核心',
)

export type ConfigSave<T> = { form: ConfigDescription; data: Ref<T>; name: string }

export const useConfig = defineStore('config', helper => {
  const configDescription = shallowReactive(new Map<symbol, ConfigSave<any>>())

  const $load = helper.action(
    <T extends ConfigPointer>(pointer: T): ConfigSave<FormResult<T['config']>> => {
      const v = configDescription.get(pointer.key)
      if (!v) throw new Error(`not found config by plugin "${pointer.pluginName}"`)
      return v
    },
    'load',
  )

  const $loadApp = helper.action(() => $load(appConfig), 'loadApp')

  const isSystemDark = matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = computed(() => {
    if (!$isExistConfig(appConfig)) return isSystemDark
    const cfg = $load(appConfig).data.value
    switch (cfg.darkMode) {
      case 'light':
        return false
      case 'dark':
        return true
      case 'system':
      default:
        return isSystemDark
    }
  })
  const $isExistConfig = helper.action(
    (pointer: ConfigPointer) => configDescription.has(pointer.key),
    'isExistConfig',
  )
  const $resignerConfig = helper.action((pointer: ConfigPointer) => {
    const store = useDbConfig(pointer.pluginName, pointer.config)
    configDescription.set(pointer.key, {
      form: pointer.config,
      data: store,
      name: pointer.pluginName,
    })
  }, 'resignerConfig')

  $resignerConfig(appConfig) // important: register core config first, because app depend on it

  return { isDark, form: configDescription, $loadApp, $load, $isExistConfig, $resignerConfig }
})