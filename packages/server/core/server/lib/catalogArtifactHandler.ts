import { PluginArtifactConflictError, type PluginArtifactStore } from './catalogArtifacts'

export interface PluginArtifactUploadHandlerOptions {
  store: PluginArtifactStore
  uploadPath?: string
  authorizeWrite?: (request: Request) => boolean | string | Promise<boolean | string>
}

export interface PluginArtifactUploadHandler {
  fetch(request: Request): Promise<Response>
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })

const header = (request: Request, name: string): string => {
  const value = request.headers.get(name)?.trim()
  if (!value) throw new TypeError(`${name} header is required`)
  return value
}

export const createPluginArtifactUploadHandler = (
  options: PluginArtifactUploadHandlerOptions,
): PluginArtifactUploadHandler => {
  const uploadPath = options.uploadPath ?? '/plugins/catalog/artifacts'
  const authorizeWrite = options.authorizeWrite ?? (() => false)

  return {
    async fetch(request) {
      const pathname = new URL(request.url).pathname
      if (pathname !== uploadPath) return new Response('Not Found', { status: 404 })
      if (request.method !== 'POST') {
        return new Response(null, { status: 405, headers: { allow: 'POST' } })
      }
      const identity = await authorizeWrite(request)
      if (!identity) return new Response(null, { status: 401 })

      try {
        const body = await request.arrayBuffer()
        const artifact = await options.store.upload({
          body,
          mimeType: header(request, 'content-type'),
          platform: header(request, 'x-plugin-platform'),
          pluginId: header(request, 'x-plugin-id'),
          version: header(request, 'x-plugin-version'),
        })
        return json({ artifact, publisherId: typeof identity === 'string' ? identity : undefined })
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : 'invalid artifact upload' },
          error instanceof PluginArtifactConflictError ? 409 : 400,
        )
      }
    },
  }
}