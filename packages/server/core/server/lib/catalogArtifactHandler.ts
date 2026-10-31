import { PluginArtifactConflictError, type PluginArtifactStore } from './catalogArtifacts'
import { json } from './catalogHandler'

const header = (request: Request, name: string): string => {
  const value = request.headers.get(name)?.trim()
  if (!value) throw new TypeError(`${name} header is required`)
  return value
}

export const handlePluginArtifactUpload = async (
  request: Request,
  store: PluginArtifactStore,
  authorizeWrite: (request: Request) => Promise<boolean>,
): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { allow: 'POST' } })
  }
  if (!(await authorizeWrite(request))) return new Response(null, { status: 401 })

  try {
    const artifact = await store.upload({
      body: await request.arrayBuffer(),
      mimeType: header(request, 'content-type'),
      platform: header(request, 'x-plugin-platform'),
      pluginId: header(request, 'x-plugin-id'),
      version: header(request, 'x-plugin-version'),
    })
    return json({ artifact })
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'invalid artifact upload' },
      error instanceof PluginArtifactConflictError ? 409 : 400,
    )
  }
}