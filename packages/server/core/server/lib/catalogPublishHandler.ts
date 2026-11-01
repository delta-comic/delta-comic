import { json } from './catalogHandler'
import {
  createPluginReleasePublisher,
  parsePluginRelease,
  PluginCatalogConflictError,
  type PluginCatalogStore,
  type PluginReleaseMetadata,
} from './catalogProtocol/index.js'

interface PublishPayload {
  release?: unknown
  metadata?: { name?: unknown; description?: unknown }
  pluginId?: unknown
  version?: unknown
}

const readMetadata = ({ metadata }: PublishPayload): PluginReleaseMetadata => {
  if (typeof metadata?.name !== 'string' || !metadata.name.trim()) {
    throw new TypeError('publish metadata name is required')
  }
  if (metadata.description !== undefined && typeof metadata.description !== 'string') {
    throw new TypeError('publish metadata description must be a string')
  }
  return { name: metadata.name, description: metadata.description }
}

export const handlePluginPublishRequest = async (
  request: Request,
  store: PluginCatalogStore,
  authorizeWrite: (request: Request) => Promise<boolean>,
  yank: boolean,
): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { allow: 'POST' } })
  }
  if (!(await authorizeWrite(request))) return new Response(null, { status: 401 })

  const publisher = createPluginReleasePublisher(store)
  try {
    const payload: PublishPayload | null = await request.json()
    if (!payload || typeof payload !== 'object') throw new TypeError('invalid publish payload')
    if (!yank) {
      return json(
        await publisher.publish(parsePluginRelease(payload.release), readMetadata(payload)),
      )
    }
    if (typeof payload.pluginId !== 'string' || typeof payload.version !== 'string') {
      throw new TypeError('yank pluginId and version are required')
    }
    return json(await publisher.yank(payload.pluginId, payload.version))
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'invalid publish payload' },
      error instanceof PluginCatalogConflictError ? 409 : 400,
    )
  }
}