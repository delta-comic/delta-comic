import { defaultsDeep } from 'es-toolkit/compat'

import type { PluginLocaleMessage, PluginLocaleMessages } from '../api/i18n'

export type { PluginLocaleMessage, PluginLocaleMessages } from '../api/i18n'

export interface PluginI18nAdapter {
  setLocaleMessage(locale: string, message: PluginLocaleMessage): void
  translate?(key: string, params?: Record<string, number | string>): string
}

const messageKeyPrefix = 'i18n:'

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
    this.pluginMessages.set(plugin, defaultsDeep(messages, previous))
    this.refresh(new Set([...Object.keys(previous), ...Object.keys(messages)]))
  }

  public remove(plugin: string) {
    const messages = this.pluginMessages.get(plugin)
    if (!messages) return
    this.pluginMessages.delete(plugin)
    this.refresh(new Set(Object.keys(messages)))
  }

  public translate(key: string, params?: Record<string, number | string>) {
    return this.adapter?.translate?.(key, params) ?? key
  }

  private compose(locale: string) {
    const message = this.baseMessages[locale]
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

export const pluginMessageKey = (key: string) => `${messageKeyPrefix}${key}`

export const translatePluginText = (value: string) =>
  value.startsWith(messageKeyPrefix)
    ? pluginI18n.translate(value.slice(messageKeyPrefix.length))
    : value