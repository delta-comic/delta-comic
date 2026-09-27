import type { LocaleShape } from './schema'
import zhCN from './zh-CN'

export const localeMessages = { 'zh-CN': zhCN }

export type AppMessageSchema = LocaleShape<typeof zhCN>