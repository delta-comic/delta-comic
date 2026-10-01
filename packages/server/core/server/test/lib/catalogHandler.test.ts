import { createMemoryPluginCatalogStore } from '@delta-comic/both'
import { describe, expect, it } from 'vitest'

import { createPluginCatalogHandler } from '../../lib/catalogHandler'

const catalog = { protocolVersion: 1 as const, generatedAt: 'now', entries: [] }

describe('plugin catalog handler', () => {
  it('serves the catalog publicly and protects writes', async () => {
    const store = createMemoryPluginCatalogStore(catalog)
    const handler = createPluginCatalogHandler({
      store,
      authorizeWrite: request => request.headers.get('authorization') === 'Bearer publisher',
    })

    await expect(
      handler.fetch(new Request('https://example.com/plugins/catalog/index.json')),
    ).resolves.toMatchObject({ status: 200 })
    await expect(
      handler.fetch(
        new Request('https://example.com/plugins/catalog/index.json', {
          method: 'PUT',
          body: JSON.stringify(catalog),
        }),
      ),
    ).resolves.toMatchObject({ status: 401 })
    await expect(
      handler.fetch(
        new Request('https://example.com/plugins/catalog/index.json', {
          method: 'PUT',
          headers: { authorization: 'Bearer publisher' },
          body: JSON.stringify(catalog),
        }),
      ),
    ).resolves.toMatchObject({ status: 200 })
  })

  it('validates writes and rejects unrelated methods and paths', async () => {
    const handler = createPluginCatalogHandler({
      store: createMemoryPluginCatalogStore(),
      authorizeWrite: () => true,
    })

    const invalid = await handler.fetch(
      new Request('https://example.com/plugins/catalog/index.json', {
        method: 'PUT',
        body: JSON.stringify({ protocolVersion: 1 }),
      }),
    )
    expect(invalid.status).toBe(400)
    expect(
      (
        await handler.fetch(
          new Request('https://example.com/plugins/catalog/index.json', { method: 'POST' }),
        )
      ).status,
    ).toBe(405)
    expect((await handler.fetch(new Request('https://example.com/other'))).status).toBe(404)
  })

  it('returns an ETag and rejects stale conditional writes', async () => {
    const store = createMemoryPluginCatalogStore(catalog)
    const handler = createPluginCatalogHandler({ store, authorizeWrite: () => true })
    const read = await handler.fetch(new Request('https://example.com/plugins/catalog/index.json'))
    const version = read.headers.get('etag')
    expect(version).toMatch(/^"\d+"$/)

    const update = await handler.fetch(
      new Request('https://example.com/plugins/catalog/index.json', {
        method: 'PUT',
        headers: { 'if-match': version!, 'content-type': 'application/json' },
        body: JSON.stringify({ ...catalog, generatedAt: 'updated' }),
      }),
    )
    expect(update.status).toBe(200)
    expect(update.headers.get('etag')).toBeNull()

    const stale = await handler.fetch(
      new Request('https://example.com/plugins/catalog/index.json', {
        method: 'PUT',
        headers: { 'if-match': version!, 'content-type': 'application/json' },
        body: JSON.stringify(catalog),
      }),
    )
    expect(stale.status).toBe(412)
  })
})