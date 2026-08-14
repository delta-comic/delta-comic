import { defaultsDeep } from 'es-toolkit/compat'

import type { PluginLocaleMessage, PluginLocaleMessages } from '../api/i18n'

export type { PluginLocaleMessage, PluginLocaleMessages } from '../api/i18n'

export interface PluginI18nAdapter {
  setLocaleMessage(locale: string, message: PluginLocaleMessage): void
  translate?(key: string, params?: Record<string, number | string>): string
  /** 判断消息是否已注册（建议覆盖回退语言链），用于解析宿主渲染的展示文本。 */
  has?(key: string): boolean
}

export class PluginI18nRegistry {
  private adapter?: PluginI18nAdapter
  private baseMessages: PluginLocaleMessages = {}
  private readonly pluginMessages = new Map<string, PluginLocaleMessages>()

  public install(adapter: PluginI18nAdapter, baseMessages: PluginLocaleMessages) {
    this.adapter = adapter
    this.baseMessages = baseMessages
    this.refresh(this.locales())
  }

  public register(plugin: string, messages: PluginLocaleMessages) {
    const previous = this.pluginMessages.get(plugin) ?? {}
    const merged: PluginLocaleMessages = defaultsDeep({}, messages, previous)
    this.pluginMessages.set(plugin, merged)
    this.refresh(new Set([...Object.keys(previous), ...Object.keys(messages)]))
  }

  public remove(plugin: string) {
    const messages = this.pluginMessages.get(plugin)
    if (!messages) return
    this.pluginMessages.delete(plugin)
    this.refresh(new Set(Object.keys(messages)))
  }

  /**
   * 立即翻译一个 i18n key，供插件在自己的运行时回调中使用；
   * 未注册或没有适配器时返回 key 本身。
   */
  public translate(key: string, params?: Record<string, number | string>) {
    return this.adapter?.translate?.(key, params) ?? key
  }

  /**
   * 解析插件提供的展示文本：命中已注册的普通 i18n key 时翻译，
   * 否则按字面文本原样返回。宿主渲染的插件字符串字段
   * （如 `Selection.name`、清单展示名）都应经过本方法。
   */
  public translateText(value: string) {
    if (this.adapter?.has?.(value)) return this.translate(value)
    return value
  }

  private compose(locale: string) {
    const message: PluginLocaleMessage = {}
    defaultsDeep(message, this.baseMessages[locale])
    for (const messages of this.pluginMessages.values()) defaultsDeep(message, messages[locale])
    return message
  }

  private locales() {
    const locales = new Set(Object.keys(this.baseMessages))
    for (const messages of this.pluginMessages.values()) {
      for (const locale of Object.keys(messages)) locales.add(locale)
    }
    return locales
  }

  private refresh(locales: Iterable<string>) {
    if (!this.adapter) return
    for (const locale of locales) this.adapter.setLocaleMessage(locale, this.compose(locale))
  }
}

export const pluginI18n = new PluginI18nRegistry()