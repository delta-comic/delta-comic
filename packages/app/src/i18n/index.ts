import { pluginI18n, type PluginI18nAdapter } from '@delta-comic/plugin'
import { createI18n } from 'vue-i18n'

import { localeMessages } from './locales'

export const i18n = createI18n({
  fallbackLocale: 'zh-CN',
  legacy: false,
  locale: 'zh-CN',
  messages: localeMessages,
})

const i18nAdapter: PluginI18nAdapter = {
  setLocaleMessage(locale, message) {
    const composer = i18n.global as PluginI18nAdapter
    composer.setLocaleMessage(locale, message)
  },
  translate(key, params) {
    return i18n.global.t(key, params ?? {})
  },
  has(key) {
    return i18n.global.te(key)
  },
}

pluginI18n.install(i18nAdapter, localeMessages)

/**
 * 软翻译宿主渲染的展示文本：值命中已注册的 i18n key 时返回翻译结果，
 * 否则按字面文本原样返回；空值返回空字符串。
 * 插件注册的消息与宿主消息共享同一棵消息树，因此本方法同时覆盖两者。
 */
export const translateText = (value: string | null | undefined): string =>
  value ? (i18n.global.te(value) ? i18n.global.t(value) : value) : ''