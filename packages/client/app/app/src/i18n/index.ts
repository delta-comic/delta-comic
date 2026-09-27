import { pluginI18n, type PluginI18nAdapter } from '@delta-comic/plugin'
import dayjs, { type Dayjs } from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/zh-tw'
import { createI18n } from 'vue-i18n'

import { localeMessages } from './locales'

dayjs.extend(localizedFormat)

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

/** dayjs 语言包与 vue-i18n locale 的映射（en 为 dayjs 内置语言）。 */
const DAYJS_LOCALES: Record<string, string> = { 'zh-CN': 'zh-cn', 'en-US': 'en', 'zh-TW': 'zh-tw' }

export type DateFormatPreset = 'date' | 'dateTime' | 'monthDay' | 'time'

/** 各 locale 的日期展示格式，渲染由 dayjs 本地化数据完成。 */
const DATE_FORMATS: Record<string, Record<DateFormatPreset, string>> = {
  'zh-CN': { date: 'LL', dateTime: 'LL HH:mm', monthDay: 'M月D日', time: 'HH:mm' },
  'en-US': { date: 'LL', dateTime: 'LL h:mm A', monthDay: 'MMM D', time: 'HH:mm' },
  'zh-TW': { date: 'LL', dateTime: 'LL HH:mm', monthDay: 'M月D日', time: 'HH:mm' },
}

const FALLBACK_DATE_FORMATS: Record<DateFormatPreset, string> = {
  date: 'LL',
  dateTime: 'LL HH:mm',
  monthDay: 'MMM D',
  time: 'HH:mm',
}

/**
 * 按当前 locale 格式化日期，由 dayjs 负责解析与本地化渲染；
 * 无法解析的值返回空字符串。
 */
export const formatDate = (
  value: Dayjs | Date | string | number,
  preset: DateFormatPreset,
): string => {
  const locale = DAYJS_LOCALES[i18n.global.locale.value] ?? i18n.global.locale.value.toLowerCase()
  const date = dayjs(value).locale(locale)
  const format = DATE_FORMATS[i18n.global.locale.value]?.[preset] ?? FALLBACK_DATE_FORMATS[preset]
  return date.isValid() ? date.format(format) : ''
}