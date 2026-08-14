import type { FormConfigure, FormSingleConfigure } from '@delta-comic/model'
import { translatePluginText } from '@delta-comic/plugin'

import { i18n } from './index'

/**
 * 解析插件提供的展示文本：
 * - `i18n:` 前缀走插件文本协议（由 `pluginMessageKey` 注册的键）
 * - 其余按普通 i18n 键在宿主消息中查找，未注册时原样返回
 */
export const resolvePluginText = (value: string): string => {
  const protocol = translatePluginText(value)
  if (protocol !== value) return protocol
  return i18n.global.te(value) ? i18n.global.t(value) : value
}

/**
 * 本地化插件表单字段的展示文本（`info`、`placeholder`、`selects[].label` 与开关文案）。
 * 只替换字符串值，不改变字段结构。
 */
export const localizeFormConfig = (config: FormSingleConfigure): FormSingleConfigure => {
  const base = {
    info: resolvePluginText(config.info),
    placeholder: config.placeholder ? resolvePluginText(config.placeholder) : undefined,
  }
  switch (config.type) {
    case 'radio':
    case 'checkbox':
      return {
        ...config,
        ...base,
        selects: config.selects.map(option => ({
          ...option,
          label: resolvePluginText(option.label),
        })),
      }
    case 'switch':
      return {
        ...config,
        ...base,
        open: config.open ? resolvePluginText(config.open) : undefined,
        close: config.close ? resolvePluginText(config.close) : undefined,
      }
    default:
      return { ...config, ...base }
  }
}

export const localizeForm = <T extends FormConfigure>(form: T): T =>
  Object.fromEntries(
    Object.entries(form).map(([key, config]) => [key, localizeFormConfig(config)]),
  ) as T