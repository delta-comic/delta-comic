import { parseModuleManifest } from '@delta-comic/platform/manifest'

import { sha256Integrity } from './artifact'
import type { PluginFileStore } from './contracts'

export async function manifestRevision(bytes: Uint8Array) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)))
  return Array.from(digest, b => b.toString(16).padStart(2, '0')).join('')
}

export function revisionKey(plugin: string, revision: string) {
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(plugin) || !/^[a-f0-9]{64}$/.test(revision))
    throw new Error('invalid plugin revision key')
  // The reserved prefix cannot be an installation ID, including legacy IDs.
  return `_${plugin}.${revision}`
}

export async function readRevision(
  files: Pick<PluginFileStore, 'read'>,
  id: string,
  revision: string,
) {
  const key = revisionKey(id, revision)
  const bytes = await files.read(key, 'manifest.json')
  if ((await manifestRevision(bytes)) !== revision)
    throw new Error(`${id}: manifest integrity mismatch`)
  const manifest = parseModuleManifest(JSON.parse(new TextDecoder().decode(bytes)))
  if (manifest.id !== id) throw new Error(`unexpected plugin ${manifest.id}: expected ${id}`)
  const resources = new Map<string, Uint8Array>()
  for (const resource of manifest.resources) {
    const contents = await files.read(key, resource.path)
    if ((await sha256Integrity(contents)) !== resource.integrity)
      throw new Error(`${id}: integrity mismatch: ${resource.path}`)
    resources.set(resource.path, contents)
  }
  return { manifest, resources }
}