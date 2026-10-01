import { describe, expect, it } from 'vitest'

import { createPluginArtifactUploadHandler, createR2PluginArtifactStore } from '../../lib/index'

describe('plugin artifact uploads', () => {
  it('stores artifacts with an integrity digest and stable public URL', async () => {
    const writes: Array<{ key: string; body: ArrayBuffer; mimeType?: string; onlyIf?: string }> = []
    const store = createR2PluginArtifactStore(
      {
        async put(key, body, options) {
          writes.push({
            key,
            body,
            mimeType: options?.httpMetadata?.contentType,
            onlyIf: options?.onlyIf?.get('if-none-match') ?? undefined,
          })
        },
      },
      'https://plugins.example/files',
    )

    const artifact = await store.upload({
      body: await new Response('demo').arrayBuffer(),
      mimeType: 'application/zip',
      platform: 'desktop',
      pluginId: 'demo.plugin',
      version: '1.0.0',
    })

    expect(artifact).toMatchObject({
      mimeType: 'application/zip',
      platform: 'desktop',
      size: 4,
      url: 'https://plugins.example/files/artifacts/demo.plugin/1.0.0/desktop.zip',
    })
    expect(artifact.integrity).toMatch(/^sha256-[A-Za-z0-9+/]+=*$/)
    expect(writes[0]).toMatchObject({
      key: 'artifacts/demo.plugin/1.0.0/desktop.zip',
      mimeType: 'application/zip',
      onlyIf: '*',
    })
  })

  it('requires publisher authorization and validates upload headers', async () => {
    const store = createR2PluginArtifactStore(
      { put: async () => undefined },
      'https://plugins.example/files',
    )
    const handler = createPluginArtifactUploadHandler({
      store,
      authorizeWrite: request => request.headers.get('authorization') === 'Bearer publisher',
    })

    await expect(
      handler.fetch(
        new Request('https://example.test/plugins/catalog/artifacts', { method: 'POST' }),
      ),
    ).resolves.toHaveProperty('status', 401)
    const response = await handler.fetch(
      new Request('https://example.test/plugins/catalog/artifacts', {
        body: 'demo',
        headers: {
          'authorization': 'Bearer publisher',
          'content-type': 'application/zip',
          'x-plugin-id': 'demo.plugin',
          'x-plugin-platform': 'desktop',
          'x-plugin-version': '1.0.0',
        },
        method: 'POST',
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ artifact: { platform: 'desktop' } })
  })

  it('reports a conflict when an artifact version already exists', async () => {
    const store = createR2PluginArtifactStore(
      { put: async () => null },
      'https://plugins.example/files',
    )
    const handler = createPluginArtifactUploadHandler({ store, authorizeWrite: () => true })
    const response = await handler.fetch(
      new Request('https://example.test/plugins/catalog/artifacts', {
        body: 'demo',
        headers: {
          'content-type': 'application/zip',
          'x-plugin-id': 'demo.plugin',
          'x-plugin-platform': 'desktop',
          'x-plugin-version': '1.0.0',
        },
        method: 'POST',
      }),
    )
    expect(response.status).toBe(409)
  })
})