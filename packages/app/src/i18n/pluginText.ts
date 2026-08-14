import type { FormConfigure, FormSingleConfigure } from '@delta-comic/model'
import { pluginI18n } from '@delta-comic/plugin'

/**
 * 本地化插件表单字段的展示文本（`info`、`placeholder`、`selects[].label` 与开关文案）。
 * 只替换字符串值，不改变字段结构。
 */
export const localizeFormConfig = (config: FormSingleConfigure): FormSingleConfigure => {
  const base = {
    info: pluginI18n.translateText(config.info),
    placeholder: config.placeholder ? pluginI18n.translateText(config.placeholder) : undefined,
  }
  switch (config.type) {
    case 'radio':
    case 'checkbox':
      return {
        ...config,
        ...base,
        selects: config.selects.map(option => ({
          ...option,
          label: pluginI18n.translateText(option.label),
        })),
      }
    case 'switch':
      return {
        ...config,
        ...base,
        open: config.open ? pluginI18n.translateText(config.open) : undefined,
        close: config.close ? pluginI18n.translateText(config.close) : undefined,
      }
    default:
      return { ...config, ...base }
  }
}

export const localizeForm = <T extends FormConfigure>(form: T): T =>
  Object.fromEntries(
    Object.entries(form).map(([key, config]) => [key, localizeFormConfig(config)]),
  ) as T