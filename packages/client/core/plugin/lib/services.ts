import type {
  ClientCollection,
  ClientConfig,
  ClientContent,
  ClientI18n,
  ClientRemote,
  ClientUi,
  ClientUiRegistrars,
  ClientUser,
  Content,
  Remote,
  Social,
  User,
  PluginLocaleMessages,
} from '@delta-comic/client'
import {
  UniComment,
  UniContentPage,
  UniItem,
  UniResource,
  UniUser,
} from '@delta-comic/client-core-model'
import { environmentRegistry } from '@delta-comic/client-ui-ui/environment'
import { Service, type Context } from 'cordis'
import { shallowReactive } from 'vue'

import { selectFastestEndpoint } from './adapters/endpointProbe'
import { pluginI18n } from './adapters/i18n'

export interface PluginAuthGateway {
  authenticate(plugin: string, auth: User.Auth, signal: AbortSignal): Promise<void>
}

export type PluginOwner = (ctx: Context) => string

class CollectionService<T> extends Service implements ClientCollection<T> {
  public readonly entries = shallowReactive(new Map<string, T>())

  public constructor(
    ctx: Context,
    name: string,
    protected readonly owner: PluginOwner,
  ) {
    super(ctx, name)
  }

  public register(value: T) {
    const owner = this.owner(this.ctx)
    return this.ctx.effect(() => {
      if (this.entries.has(owner)) throw new Error(`duplicate ${this.name} registration: ${owner}`)
      this.entries.set(owner, value)
      return () => {
        this.entries.delete(owner)
      }
    })
  }
}

interface ModelRegistry<Key, Value> {
  has(key: Key): boolean
  set(key: Key, value: Value): unknown
  delete(key: Key): boolean
}

const bind = <Key, Value>(
  ctx: Context,
  registry: ModelRegistry<Key, Value>,
  key: Key,
  value: Value | undefined,
) => {
  if (value === undefined) return () => {}
  return ctx.effect(() => {
    if (registry.has(key)) throw new Error(`duplicate model registration: ${String(key)}`)
    registry.set(key, value)
    return () => {
      registry.delete(key)
    }
  })
}

export class ContentService
  extends CollectionService<Content.ContentModel>
  implements ClientContent
{
  public constructor(ctx: Context, owner: PluginOwner) {
    super(ctx, 'content', owner)
  }

  public override register(value: Content.ContentModel) {
    const owner = this.owner(this.ctx)
    const dispose = super.register(value)
    return this.ctx.effect(
      function* (this: ContentService) {
        yield dispose
        for (const model of value.models ?? []) {
          if (!model.name) throw new Error('content model name cannot be empty')
          const key: [string, string] = [owner, model.name]
          yield bind(this.ctx, UniContentPage.layouts, key, model.Layout)
          yield bind(this.ctx, UniItem.itemCards, key, model.ItemCard)
          yield bind(this.ctx, UniContentPage.contentPages, key, model.ContentPage)
          yield bind(this.ctx, UniContentPage.downloadProviders, key, model.DownloadProvider)
          yield bind(this.ctx, UniComment.commentRow, key, model.CommentRow)
          yield bind(this.ctx, UniItem.itemTranslator, key, model.ItemTranslator)
        }
      }.bind(this),
    )
  }

  public onHotCategoryClick(category: Content.HotCategory) {
    this.ctx.emit('content/hot-category', this.owner(this.ctx), category)
  }

  public onHotTopButtonClick(button: Content.HotTopButton) {
    this.ctx.emit('content/hot-button', this.owner(this.ctx), button)
  }
}

export class UserService extends CollectionService<User.UserModel> implements ClientUser {
  public constructor(
    ctx: Context,
    owner: PluginOwner,
    private readonly auth: () => PluginAuthGateway | undefined = () => undefined,
  ) {
    super(ctx, 'user', owner)
  }

  public override register(value: User.UserModel) {
    const owner = this.owner(this.ctx)
    const dispose = super.register(value)
    return this.ctx.effect(
      function* (this: UserService) {
        yield dispose
        yield bind(this.ctx, UniUser.userCards, owner, value.card)
        yield bind(this.ctx, UniUser.userEditorBase, owner, value.edit)
      }.bind(this),
    )
  }

  public async authenticate(signal: AbortSignal) {
    const owner = this.owner(this.ctx)
    const user = this.entries.get(owner)
    if (!user) throw new Error(`user model is unavailable: ${owner}`)
    await this.auth()?.authenticate(owner, user.auth, signal)
  }
}

export class ShareService extends CollectionService<Social.SocialModel> {
  public constructor(ctx: Context, owner: PluginOwner) {
    super(ctx, 'share', owner)
  }
}

export class RemoteService extends Service implements ClientRemote {
  public readonly entries = shallowReactive(new Map<string, Remote.RemoteModel>())

  public constructor(
    ctx: Context,
    private readonly owner: PluginOwner,
  ) {
    super(ctx, 'remote')
  }

  public async register(value: Remote.RemoteModel) {
    const owner = this.owner(this.ctx)
    const controller = new AbortController()
    return await this.ctx.effect(
      async function* (this: RemoteService) {
        yield () => controller.abort()
        for (const group of value) {
          const sources = typeof group.remotes === 'function' ? [group.remotes] : group.remotes
          const remotes = (
            await Promise.all(
              sources.map(source =>
                typeof source === 'function' ? source(controller.signal) : source,
              ),
            )
          ).flat()
          const selected = await selectFastestEndpoint(
            remotes.map(remote => ({
              test: remote.test ?? group.test,
              url: remote.url,
              value: remote,
            })),
            controller.signal,
          )
          controller.signal.throwIfAborted()
          if (!selected && !group.allowNoConnected) {
            throw new Error(`no reachable endpoint: ${owner}/${group.name}`)
          }
          if (group.type !== 'resource') continue
          const key: [string, string] = [owner, group.name]
          yield bind(
            this.ctx,
            UniResource.fork,
            key,
            remotes.map(remote => remote.url),
          )
          yield bind(this.ctx, UniResource.precedenceFork, key, selected?.url)
          for (const processor of group.processors ?? []) {
            yield bind(this.ctx, UniResource.processInstances, [owner, processor.name], processor)
          }
        }
        if (this.entries.has(owner)) throw new Error(`duplicate remote registration: ${owner}`)
        this.entries.set(owner, value)
        yield () => {
          this.entries.delete(owner)
        }
      }.bind(this),
    )
  }
}

export class I18nService extends Service implements ClientI18n {
  public constructor(
    ctx: Context,
    private readonly owner: PluginOwner,
  ) {
    super(ctx, 'i18n')
  }

  public register(messages: PluginLocaleMessages) {
    const owner = `${this.owner(this.ctx)}:${this.ctx.fiber.uid}`
    return this.ctx.effect(() => {
      pluginI18n.register(owner, messages)
      return () => pluginI18n.remove(owner)
    })
  }

  public translate(key: string, params?: Record<string, string | number>) {
    return pluginI18n.translate(key, params)
  }

  public translateText(value: string) {
    return pluginI18n.translateText(value)
  }
}

export class UiService extends Service implements ClientUi {
  public constructor(
    ctx: Context,
    private readonly owner: PluginOwner,
    private readonly registrars: ClientUiRegistrars,
  ) {
    super(ctx, 'ui')
  }

  public registerRoute(...args: Parameters<ClientUi['registerRoute']>) {
    const dispose = this.registrars.route?.(...args, this.owner(this.ctx))
    return this.ctx.effect(() => dispose ?? (() => {}))
  }

  public registerNavItem(...args: Parameters<ClientUi['registerNavItem']>) {
    const dispose = this.registrars.navItem?.(...args, this.owner(this.ctx))
    return this.ctx.effect(() => dispose ?? (() => {}))
  }

  public registerCommand(...args: Parameters<ClientUi['registerCommand']>) {
    const dispose = this.registrars.command?.(...args, this.owner(this.ctx))
    return this.ctx.effect(() => dispose ?? (() => {}))
  }

  public registerEnvironment(...args: Parameters<ClientUi['registerEnvironment']>) {
    const [key, component, condition] = args
    return this.ctx.effect(() =>
      environmentRegistry.register(key, component, condition, this.owner(this.ctx)),
    )
  }
}

export class ConfigService extends Service implements ClientConfig {
  public constructor(
    ctx: Context,
    private readonly config: ClientConfig,
  ) {
    super(ctx, 'config')
  }

  public get(plugin: string) {
    return this.config.get(plugin)
  }

  public set(plugin: string, value: Record<string, unknown>) {
    return this.config.set(plugin, value)
  }
}