import enUS from './en-US'
import type { LocaleShape } from './schema'
import zhCN from './zh-CN'
import zhTW from './zh-TW'

export const localeMessages = { 'en-US': enUS, 'zh-CN': zhCN, 'zh-TW': zhTW }

export type AppLocale = keyof typeof localeMessages
export type AppMessageSchema = LocaleShape<typeof zhCN>