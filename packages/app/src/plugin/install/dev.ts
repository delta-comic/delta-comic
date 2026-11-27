import { DEV_MANIFEST_PATH, revisionPath } from '@delta-comic/platform/manifest/dev'

import { validateArtifact } from './artifact'
import { parsePluginManifest } from './manifest'
import { manifestRevision } from './revision'

export const DEV_SERVER_LOADER_ID = 'dev-server'
export const DEV_SERVER_SOURCE_PREFIX = 'dev:'
export * from '@delta-comic/platform/manifest/dev'

export const parseDevServerPort = (input: string): number | undefined => {
  const match = new RegExp(`^${DEV_SERVER_SOURCE_PREFIX}(\\d+)$`).exec(input)
  if (!match) return undefined
  const port = Number(match[1])
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : undefined
}

export const devServerUrl = (port: number, path: string) =>
  `http://localhost:${port}${path.startsWith('/') ? path : `/${path}`}`

export const readDevArtifact = async (
  port: number,
  signal: AbortSignal,
  expectedRevision?: string,
) => {
  const response = await fetch(
    devServerUrl(
      port,
      expectedRevision ? revisionPath(expectedRevision, 'manifest.json') : DEV_MANIFEST_PATH,
    ),
    { cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) },
  )
  if (!response.ok) throw new Error(`development manifest request failed: ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const manifest = parsePluginManifest(JSON.parse(new TextDecoder().decode(bytes)))
  const revision = await manifestRevision(bytes)
  if (expectedRevision && revision !== expectedRevision)
    throw new Error('development revision mismatch')
  const files = new Map([['manifest.json', bytes]])
  for (const resource of manifest.resources) {
    const data = await fetch(devServerUrl(port, revisionPath(revision, resource.path)), { signal })
    if (!data.ok) throw new Error(`development resource unavailable: ${resource.path}`)
    files.set(resource.path, new Uint8Array(await data.arrayBuffer()))
  }
  await validateArtifact({ manifest, files: [...files].map(([path, bytes]) => ({ path, bytes })) })
  return { manifest, files }
}