import {
  createPluginReleasePublisher,
  parsePluginRelease,
  PluginCatalogConflictError,
  type PluginCatalogStore,
  type PluginReleaseMetadata,
} from '@delta-comic/both'

export interface PluginCatalogPublishHandlerOptions {
  store: PluginCatalogStore
  publishPath?: string
  yankPath?: string
  authorizeWrite?: (request: Request) => boolean | string | Promise<boolean | string>
}

export interface PluginCatalogPublishHandler {
  fetch(request: Request): Promise<Response>
}

const json = (body: unknown, status = 200, publisherId?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(publisherId ? { 'x-publisher-id': publisherId } : {}),
    },
  })

const readMetadata = (value: unknown): PluginReleaseMetadata => {
  if (!value || typeof value !== 'object') throw new TypeError('invalid publish payload')
  const payload = value as { metadata?: unknown; release?: unknown }
  if (!payload.metadata || typeof payload.metadata !== 'object') {
    throw new TypeError('publish metadata is required')
  }
  const metadata = payload.metadata as { name?: unknown; description?: unknown }
  if (typeof metadata.name !== 'string' || !metadata.name.trim()) {
    throw new TypeError('publish metadata name is required')
  }
  if (metadata.description !== undefined && typeof metadata.description !== 'string') {
    throw new TypeError('publish metadata description must be a string')
  }
  return { name: metadata.name, description: metadata.description }
}

export const createPluginCatalogPublishHandler = (
  options: PluginCatalogPublishHandlerOptions,
): PluginCatalogPublishHandler => {
  const publishPath = options.publishPath ?? '/plugins/catalog/releases'
  const yankPath = options.yankPath ?? `${publishPath}/yank`
  const authorizeWrite = options.authorizeWrite ?? (() => false)
  const publisher = createPluginReleasePublisher(options.store)

  return {
    async fetch(request) {
      const pathname = new URL(request.url).pathname
      if (pathname !== publishPath && pathname !== yankPath) {
        return new Response('Not Found', { status: 404 })
      }
      if (request.method !== 'POST') {
        return new Response(null, { status: 405, headers: { allow: 'POST' } })
      }
      const identity = await authorizeWrite(request)
      if (!identity) return new Response(null, { status: 401 })

      try {
        const payload = await request.json()
        if (pathname === publishPath) {
          if (!payload || typeof payload !== 'object')
            throw new TypeError('invalid publish payload')
          const body = payload as { release?: unknown }
          const release = parsePluginRelease(body.release)
          const next = await publisher.publish(release, readMetadata(payload))
          return json(next, 200, typeof identity === 'string' ? identity : undefined)
        }

        if (!payload || typeof payload !== 'object') throw new TypeError('invalid yank payload')
        const body = payload as { pluginId?: unknown; version?: unknown }
        if (typeof body.pluginId !== 'string' || typeof body.version !== 'string') {
          throw new TypeError('yank pluginId and version are required')
        }
        return json(
          await publisher.yank(body.pluginId, body.version),
          200,
          typeof identity === 'string' ? identity : undefined,
        )
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : 'invalid publish payload' },
          error instanceof PluginCatalogConflictError ? 409 : 400,
        )
      }
    },
  }
}