import {
  UniComment,
  UniContentPage,
  UniItem,
  UniResource,
  UniUser,
  type UniContentPageLike,
  type UniItemCardComponent,
} from '@delta-comic/model'
import { describe, expect, it, vi } from 'vitest'

import {
  createDefaultCapabilities,
  pluginRemoteSelectionChannel,
  type PluginCapabilityServices,
} from '../../../lib/capabilities'
import { ActivationPipeline, ContributionHub, PluginScope } from '../../../lib/kernel'

const services = (overrides: Partial<PluginCapabilityServices> = {}): PluginCapabilityServices => ({
  config: { register: vi.fn(), unregister: vi.fn() },
  contributions: new ContributionHub(),
  i18n: { register: vi.fn(), remove: vi.fn() },
  ...overrides,
})

describe('host model capabilities', () => {
  it('binds content and resource registries for exactly the lifetime of the plugin scope', async () => {
    const scope = new PluginScope('reader')
    const contentPage = class {} as unknown as UniContentPageLike
    const itemCard = {} as UniItemCardComponent
    const process = vi.fn(async path => [path, false] as [string, boolean])

    const activated = await new ActivationPipeline(createDefaultCapabilities(services())).activate(
      {
        model: {
          content: { models: [{ ContentPage: contentPage, ItemCard: itemCard, name: 'comic' }] },
          resource: {
            process: { sign: process },
            types: [{ test: async () => {}, type: 'image', urls: ['https://cdn.example'] }],
          },
        },
        name: 'reader',
      },
      { owner: 'reader', report: vi.fn(), scope, signal: scope.signal },
    )

    expect(activated).toEqual(['model', 'content-bindings', 'resource'])
    expect(UniContentPage.contentPages.get(['reader', 'comic'])).toBe(contentPage)
    expect(UniItem.itemCards.get(['reader', 'comic'])).toBe(itemCard)
    expect(UniResource.fork.get(['reader', 'image'])?.urls).toEqual(['https://cdn.example'])
    expect(UniResource.precedenceFork.get(['reader', 'image'])).toBe('https://cdn.example')
    expect(UniResource.processInstances.get(['reader', 'sign'])).toBe(process)

    await scope.dispose()

    expect(UniContentPage.contentPages.has(['reader', 'comic'])).toBe(false)
    expect(UniItem.itemCards.has(['reader', 'comic'])).toBe(false)
    expect(UniComment.commentRow.has(['reader', 'comic'])).toBe(false)
    expect(UniResource.fork.has(['reader', 'image'])).toBe(false)
    expect(UniResource.precedenceFork.has(['reader', 'image'])).toBe(false)
    expect(UniResource.processInstances.has(['reader', 'sign'])).toBe(false)
  })

  it('runs remote, auth, special, and user adapters in the fixed capability topology', async () => {
    const auth = { default: vi.fn(async () => true), selections: [] }
    const authenticate = vi.fn(async () => {})
    const onRemoteTestDone = vi.fn()
    const order: string[] = []
    const contributions = new ContributionHub()
    const scope = new PluginScope('account')
    const userCard = {} as never

    const activated = await new ActivationPipeline(
      createDefaultCapabilities(services({ auth: { authenticate }, contributions })),
    ).activate(
      {
        hooks: { onRemoteTestDone },
        model: {
          remotes: [
            {
              name: 'main',
              remotes: [{ name: 'primary', url: 'https://api.example' }],
              test: async () => {},
            },
          ],
          special: [
            { call: async () => void order.push('first'), name: 'first' },
            { call: async () => void order.push('second'), name: 'second' },
          ],
          user: {
            auth,
            card: userCard,
            favourites: { download: async () => [], upload: async () => {} },
          },
        },
        name: 'account',
      },
      { owner: 'account', report: vi.fn(), scope, signal: scope.signal },
    )

    expect(activated).toEqual(['model', 'user-bindings', 'remote', 'auth', 'special'])
    expect(UniUser.userCards.get('account')).toBe(userCard)
    expect(authenticate).toHaveBeenCalledWith('account', auth, scope.signal)
    expect(onRemoteTestDone).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'main' }),
      expect.objectContaining({ name: 'primary' }),
    )
    expect(
      contributions.channel(pluginRemoteSelectionChannel).get('account', 'main')?.value.remote,
    ).toEqual(expect.objectContaining({ name: 'primary' }))
    expect(order).toEqual(['first', 'second'])

    await scope.dispose()
    expect(UniUser.userCards.has('account')).toBe(false)
    expect(contributions.channel(pluginRemoteSelectionChannel).size).toBe(0)
  })
})