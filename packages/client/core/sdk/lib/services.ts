import type { DiagnosticRecorder } from '@delta-comic/both'
import type { DB } from '@delta-comic/db'

import type { ClientDownloader } from './downloader.js'
import type { ClientDatabase, ClientUi } from './host.js'
import type { ContentModel } from './model/content.js'
import type { RemoteModel } from './model/remote.js'
import type { SocialModel } from './model/social.js'
import type { UserModel } from './model/user.js'
import type { ClientNetwork } from './network.js'

export * as Content from './model/content.js'
export * as User from './model/user.js'
export * as Remote from './model/remote.js'
export * as Social from './model/social.js'
export * as Expose from './model/expose.js'
export * as Special from './model/special.js'
export type * from './model/content.js'
export type * from './model/user.js'
export type * from './model/remote.js'
export type * from './model/social.js'
export type * from './model/expose.js'
export type * from './model/special.js'

export interface ClientCollection<T> {
  readonly entries: ReadonlyMap<string, T>
  register(value: T): () => Promise<void>
}

export interface ClientContent extends ClientCollection<ContentModel> {
  onHotCategoryClick(category: import('./model/content.js').HotCategory): void
  onHotTopButtonClick(button: import('./model/content.js').HotTopButton): void
}

export interface ClientUser extends ClientCollection<UserModel> {
  authenticate(signal: AbortSignal): Promise<void>
}

export interface ClientRemote {
  readonly entries: ReadonlyMap<string, RemoteModel>
  register(value: RemoteModel): Promise<() => Promise<void>>
}

export interface PluginLocaleMessage {
  [key: string]: PluginLocaleMessage | string
}

export type PluginLocaleMessages = Record<string, PluginLocaleMessage>

export interface ClientI18n {
  register(messages: PluginLocaleMessages): () => Promise<void>
  translate(key: string, params?: Record<string, string | number>): string
  translateText(value: string): string
}

export interface ClientConfig {
  get(plugin: string): Readonly<Record<string, unknown>>
  set(plugin: string, value: Record<string, unknown>): Promise<void>
}

declare module 'cordis' {
  interface Context {
    config: ClientConfig
    i18n: ClientI18n
    ui: ClientUi
    content: ClientContent
    user: ClientUser
    remote: ClientRemote
    share: ClientCollection<SocialModel>
    network: ClientNetwork
    downloader: ClientDownloader
    database: ClientDatabase<DB>
    diagnostics: DiagnosticRecorder
  }

  interface Events {
    'content/hot-category'(plugin: string, category: import('./model/content.js').HotCategory): void
    'content/hot-button'(plugin: string, button: import('./model/content.js').HotTopButton): void
  }
}