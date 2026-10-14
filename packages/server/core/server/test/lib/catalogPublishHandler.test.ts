import { describe, expect, it } from 'vite-plus/test'

import {
  createMemoryPluginCatalogStore,
  type PluginRelease,
} from '../../lib/catalogProtocol/index.js'
import { createPluginCatalogPublishHandler } from '../../lib/catalogPublishHandler'

const release: PluginRelease = {
  pluginId: 'publish-demo',
  version: '1.0.0',
  manifestUrl: 'https://plugins.example/publish-demo/1.0.0/manifest.json',
  artifacts: [
    {
      platform: 'desktop',
      url: 'https://plugins.example/publish-demo/1.0.0/desktop.zip',
      mimeType: 'application/zip',
      size: 1,
      integrity: 'sha256-YQ==',
    },
  ],
  publishedAt: '2026-09-27T00:00:00Z',
}

const request = (path: string, body: unknown) =>
  new Request(`https://plugins.example${path}`, {
    method: 'POST',
    headers: { 'authorization': 'Bearer publisher', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('plugin catalog publish handler', () => {
  it('publishes and yanks a release behind authorization', async () => {
    const handler = createPluginCatalogPublishHandler({
      store: createMemoryPluginCatalogStore(),
      authorizeWrite: request =>
        request.headers.get('authorization') === 'Bearer publisher' ? 'publisher-1' : false,
    })

    await expect(
      handler.fetch(
        new Request('https://plugins.example/plugins/catalog/releases', {
          method: 'POST',
          body: JSON.stringify({ release, metadata: { name: 'Publish demo' } }),
        }),
      ),
    ).resolves.toMatchObject({ status: 401 })
    const published = await handler.fetch(
      request('/plugins/catalog/releases', { release, metadata: { name: 'Publish demo' } }),
    )
    expect(published.status).toBe(200)
    expect(published.headers.get('x-publisher-id')).toBe('publisher-1')
    await expect(
      handler.fetch(
        request('/plugins/catalog/releases/yank', {
          pluginId: release.pluginId,
          version: release.version,
        }),
      ),
    ).resolves.toMatchObject({ status: 200 })
  })

  it('rejects malformed publishing requests', async () => {
    const handler = createPluginCatalogPublishHandler({
      store: createMemoryPluginCatalogStore(),
      authorizeWrite: () => true,
    })
    const response = await handler.fetch(request('/plugins/catalog/releases', { release: {} }))
    expect(response.status).toBe(400)
  })
})