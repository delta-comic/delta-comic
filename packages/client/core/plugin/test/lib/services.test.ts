import { UniItem, UniResource } from '@delta-comic/client-core-model'
import { Context, type Plugin } from 'cordis'
import { describe, expect, it, vi } from 'vite-plus/test'

import { ContentService, RemoteService, ShareService, UiService } from '../../lib/services'

describe('native client services', () => {
  it('waits for a provider and restores registrations after the provider returns', async () => {
    const root = new Context()
    const consumer = root.plugin(
      Object.assign(
        function reader(ctx: Context) {
          ctx.share.register({ share: { initiative: [] } })
        },
        { inject: ['share'] },
      ),
    )
    expect((await consumer).state).toBe(0)

    let share: ShareService | undefined
    const provider = await root.plugin((ctx: Context) => {
      share = new ShareService(ctx, caller => caller.fiber.name)
    })
    expect((await consumer).state).toBe(2)
    expect(share?.entries.has('reader')).toBe(true)
    await provider.dispose()
    expect((await consumer).state).toBe(0)
    expect(share?.entries.size).toBe(0)

    await root.plugin((ctx: Context) => {
      share = new ShareService(ctx, caller => caller.fiber.name)
    })
    expect((await consumer).state).toBe(2)
    expect(share?.entries.has('reader')).toBe(true)
    await root.fiber.dispose()
    expect(share?.entries.size).toBe(0)
  })

  it('owns collections and model bindings in the calling plugin fiber', async () => {
    const root = new Context()
    const owner = (ctx: Context) => ctx.fiber.name
    const content = new ContentService(root, owner)
    const share = new ShareService(root, owner)
    const card = () => null
    const plugin: Plugin.Function = Object.assign(
      function reader(ctx: Context) {
        ctx.content.register({ models: [{ name: 'comic', ItemCard: card }] })
        ctx.share.register({ share: { initiative: [] } })
      },
      { inject: ['content', 'share'] },
    )

    const fiber = await root.plugin(plugin)
    expect(content.entries.has('reader')).toBe(true)
    expect(share.entries.has('reader')).toBe(true)
    expect(UniItem.itemCards.get(['reader', 'comic'])).toBe(card)

    await fiber.dispose()
    expect(content.entries.size).toBe(0)
    expect(share.entries.size).toBe(0)
    expect(UniItem.itemCards.has(['reader', 'comic'])).toBe(false)
    await root.fiber.dispose()
  })

  it('cleans model bindings when a registration is explicitly disposed', async () => {
    const root = new Context()
    const content = new ContentService(root, () => 'reader')
    let dispose: (() => Promise<void>) | undefined
    const fiber = await root.plugin(
      Object.assign(
        (ctx: Context) => {
          dispose = ctx.content.register({ models: [{ name: 'comic', ItemCard: () => null }] })
        },
        { inject: ['content'] },
      ),
    )

    await dispose?.()
    expect(content.entries.size).toBe(0)
    expect(UniItem.itemCards.has(['reader', 'comic'])).toBe(false)
    await fiber.dispose()
    await root.fiber.dispose()
  })

  it('ties asynchronous remote registrations to their calling fiber', async () => {
    const root = new Context()
    const remote = new RemoteService(root, ctx => ctx.fiber.name)
    const fiber = await root.plugin(
      Object.assign(
        async function reader(ctx: Context) {
          await ctx.remote.register([
            {
              name: 'images',
              type: 'resource',
              remotes: [{ name: 'primary', url: 'https://cdn.example.test' }],
              test: async () => {},
            },
          ])
        },
        { inject: ['remote'] },
      ),
    )

    expect(remote.entries.has('reader')).toBe(true)
    expect(UniResource.precedenceFork.get(['reader', 'images'])).toBe('https://cdn.example.test')
    await fiber.dispose()
    expect(remote.entries.size).toBe(0)
    expect(UniResource.fork.has(['reader', 'images'])).toBe(false)
    await root.fiber.dispose()
  })

  it('registers UI resources with the caller owner and disposes them on unload', async () => {
    const root = new Context()
    const dispose = vi.fn()
    const route = vi.fn(() => dispose)
    new UiService(root, ctx => ctx.fiber.name, { route })
    const fiber = await root.plugin(
      Object.assign(
        function reader(ctx: Context) {
          ctx.ui.registerRoute({ path: '/library', title: 'Library', component: () => null })
        },
        { inject: ['ui'] },
      ),
    )

    expect(route).toHaveBeenCalledWith(expect.objectContaining({ path: '/library' }), 'reader')
    await fiber.dispose()
    expect(dispose).toHaveBeenCalledOnce()
    await root.fiber.dispose()
  })
})