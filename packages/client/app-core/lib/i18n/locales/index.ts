import enUS from './en-US'
import type { LocaleShape } from './schema'
import zhCN from './zh-CN'
import zhTW from './zh-TW'

export const localeMessages = { 'zh-CN': zhCN, 'en-US': enUS, 'zh-TW': zhTW }

export type AppMessageSchema = LocaleShape<typeof zhCN>