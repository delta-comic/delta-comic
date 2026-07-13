import type { AppLocale } from './locales'

export const resolveSystemLocale = (language = globalThis.navigator?.language): AppLocale => {
  const normalized = language?.trim().replaceAll('_', '-').toLowerCase()
  if (!normalized?.startsWith('zh')) return 'en-US'
  if (
    normalized === 'zh-tw' ||
    normalized.startsWith('zh-hant') ||
    normalized.startsWith('zh-hk') ||
    normalized.startsWith('zh-mo')
  )
    return 'zh-TW'
  return 'zh-CN'
}

export const resolveAppLocale = (locale: string | undefined): AppLocale => {
  if (locale === 'zh-CN' || locale === 'zh-TW' || locale === 'en-US') return locale
  return resolveSystemLocale()
}