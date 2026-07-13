import { pluginI18n, type PluginI18nAdapter, type PluginLocaleMessages } from '@delta-comic/plugin'
import { createI18n } from 'vue-i18n'

import { resolveSystemLocale } from './locale'
import { localeMessages } from './locales'

export { resolveAppLocale, resolveSystemLocale } from './locale'

export const i18n = createI18n({
  fallbackLocale: 'zh-CN',
  legacy: false,
  locale: resolveSystemLocale(),
  messages: localeMessages,
})

const i18nAdapter: PluginI18nAdapter = {
  setLocaleMessage(locale, message) {
    const composer = i18n.global as unknown as PluginI18nAdapter
    composer.setLocaleMessage(locale, message)
  },
  translate(key, params) {
    return i18n.global.t(key, params ?? {})
  },
}

pluginI18n.install(i18nAdapter, localeMessages as unknown as PluginLocaleMessages)