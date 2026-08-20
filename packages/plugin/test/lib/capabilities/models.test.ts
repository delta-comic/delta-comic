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
    const call = vi.fn(async path => [path, false] as [string, boolean])
    const sign = { name: 'sign', call }

    const activated = await new ActivationPipeline(createDefaultCapabilities(services())).activate(
      {
        model: {
          content: { models: [{ ContentPage: contentPage, ItemCard: itemCard, name: 'comic' }] },
          remotes: [
            {
              type: 'resource',
              name: 'image',
              test: async () => {},
              remotes: [{ name: 'primary', url: 'https://cdn.example' }],
              processors: [sign],
            },
          ],
        },
        name: 'reader',
      },
      { owner: 'reader', report: vi.fn(), scope, signal: scope.signal },
    )

    expect(activated).toEqual(['model', 'content-bindings', 'remote'])
    expect(UniContentPage.contentPages.get(['reader', 'comic'])).toBe(contentPage)
    expect(UniItem.itemCards.get(['reader', 'comic'])).toBe(itemCard)
    expect(UniResource.fork.get(['reader', 'image'])).toEqual(['https://cdn.example'])
    expect(UniResource.precedenceFork.get(['reader', 'image'])).toBe('https://cdn.example')
    expect(UniResource.processInstances.get(['reader', 'sign'])).toBe(sign)

    await scope.dispose()

    expect(UniContentPage.contentPages.has(['reader', 'comic'])).toBe(false)
    expect(UniItem.itemCards.has(['reader', 'comic'])).toBe(false)
    expect(UniComment.commentRow.has(['reader', 'comic'])).toBe(false)
    expect(UniResource.fork.has(['reader', 'image'])).toBe(false)
    expect(UniResource.precedenceFork.has(['reader', 'image'])).toBe(false)
    expect(UniResource.processInstances.has(['reader', 'sign'])).toBe(false)
  })

  it('keeps offline resource groups registered without a preferred fork', async () => {
    const scope = new PluginScope('reader')

    const activated = await new ActivationPipeline(createDefaultCapabilities(services())).activate(
      {
        model: {
          remotes: [
            {
              allowNoConnected: true,
              name: 'image',
              type: 'resource',
              remotes: [{ name: 'primary', url: 'https://unreachable.example' }],
              test: async () => {
                throw new Error('offline')
              },
            },
          ],
        },
        name: 'reader',
      },
      { owner: 'reader', report: vi.fn(), scope, signal: scope.signal },
    )

    expect(activated).toEqual(['model', 'remote'])
    expect(UniResource.fork.get(['reader', 'image'])).toEqual(['https://unreachable.example'])
    expect(UniResource.precedenceFork.has(['reader', 'image'])).toBe(false)

    await scope.dispose()
    expect(UniResource.fork.has(['reader', 'image'])).toBe(false)
  })

  it('loads a remote list before probing each listed endpoint', async () => {
    const scope = new PluginScope('directory')
    const calls: string[] = []
    const primaryTest = vi.fn(async () => {})
    const groupTest = vi.fn(async () => {})
    const remotes = [
      { name: 'primary', url: 'https://api.example', test: primaryTest },
      { name: 'backup', url: 'https://backup.example' },
    ]
    const getRemotes = vi.fn(async (signal: AbortSignal) => {
      calls.push('list')
      expect(signal).toBe(scope.signal)
      return remotes
    })
    primaryTest.mockImplementation(async () => {
      calls.push('primary')
    })
    groupTest.mockImplementation(async () => {
      calls.push('backup')
    })
    const onRemoteTestDone = vi.fn()
    const contributions = new ContributionHub()

    await new ActivationPipeline(createDefaultCapabilities(services({ contributions }))).activate(
      {
        hooks: { onRemoteTestDone },
        model: {
          remotes: [{ name: 'main', type: 'remote', remotes: getRemotes, test: groupTest }],
        },
        name: 'directory',
      },
      { owner: 'directory', report: vi.fn(), scope, signal: scope.signal },
    )

    expect(getRemotes).toHaveBeenCalledOnce()
    expect(calls[0]).toBe('list')
    expect(calls).toContain('primary')
    expect(calls).toContain('backup')
    expect(primaryTest).toHaveBeenCalledWith('https://api.example', expect.any(AbortSignal))
    expect(groupTest).toHaveBeenCalledWith('https://backup.example', expect.any(AbortSignal))
    expect(onRemoteTestDone).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'main', remotes }),
      expect.objectContaining({ name: 'primary' }),
    )
    expect(
      contributions.channel(pluginRemoteSelectionChannel).get('directory', 'main')?.value.group
        .remotes,
    ).toBe(remotes)

    await scope.dispose()
  })

  it('binds dynamically loaded resource endpoints and the selected fork', async () => {
    const scope = new PluginScope('reader')
    const remotes = [
      { name: 'primary', url: 'https://cdn.example' },
      { name: 'backup', url: 'https://backup-cdn.example' },
    ]
    const getRemotes = vi.fn(async () => remotes)

    await new ActivationPipeline(createDefaultCapabilities(services())).activate(
      {
        model: {
          remotes: [
            {
              type: 'resource',
              name: 'image',
              remotes: getRemotes,
              test: async url => {
                if (url === 'https://cdn.example') return
                throw new Error('offline')
              },
            },
          ],
        },
        name: 'reader',
      },
      { owner: 'reader', report: vi.fn(), scope, signal: scope.signal },
    )

    expect(getRemotes).toHaveBeenCalledOnce()
    expect(UniResource.fork.get(['reader', 'image'])).toEqual([
      'https://cdn.example',
      'https://backup-cdn.example',
    ])
    expect(UniResource.precedenceFork.get(['reader', 'image'])).toBe('https://cdn.example')

    await scope.dispose()
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
              type: 'remote',
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