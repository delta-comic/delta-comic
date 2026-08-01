export interface PluginLocaleMessage {
  [key: string]: PluginLocaleMessage | string
}

export type PluginLocaleMessages = Record<string, PluginLocaleMessage>