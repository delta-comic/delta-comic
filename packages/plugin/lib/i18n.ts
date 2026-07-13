export interface PluginLocaleMessage {
  [key: string]: PluginLocaleMessage | string
}

export type PluginLocaleMessages = Record<string, PluginLocaleMessage>

export interface PluginI18nAdapter {
  setLocaleMessage(locale: string, message: PluginLocaleMessage): void
  translate?(key: string, params?: Record<string, number | string>): string
}

const messageKeyPrefix = 'i18n:'

const unsafeKeys = new Set(['__proto__', 'constructor', 'prototype'])

const mergeMessages = (
  target: PluginLocaleMessage,
  source: PluginLocaleMessage | undefined,
): PluginLocaleMessage => {
  if (!source) return target
  for (const [key, value] of Object.entries(source)) {
    if (unsafeKeys.has(key)) continue
    if (typeof value === 'string') {
      target[key] = value
      continue
    }
    const current = target[key]
    target[key] = mergeMessages(typeof current === 'object' ? { ...current } : {}, value)
  }
  return target
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
    const previous = this.pluginMessages.get(plugin)
    this.pluginMessages.delete(plugin)
    this.pluginMessages.set(plugin, messages)
    this.refresh(new Set([...Object.keys(previous ?? {}), ...Object.keys(messages)]))
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
    const message = mergeMessages({}, this.baseMessages[locale])
    for (const messages of this.pluginMessages.values()) mergeMessages(message, messages[locale])
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