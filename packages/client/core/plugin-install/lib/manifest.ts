import {
  assertPluginManifestCompatible,
  parsePluginManifest as parseManifest,
  type PluginManifest,
  type PluginManifestCompatibility,
} from '@delta-comic/shared-plugin-manifest'

export class PluginManifestError extends Error {
  public constructor(message: string) {
    super(`Invalid Delta Comic manifest: ${message}`)
    this.name = 'PluginManifestError'
  }
}

export const safePluginPath = (value: unknown, path: string) => {
  if (typeof value !== 'string' || !value.length) {
    throw new PluginManifestError(`${path} must be a non-empty string`)
  }
  const normalized = value.replaceAll('\\', '/')
  if (
    normalized.startsWith('/') ||
    /^[a-z]:($|\/)/i.test(normalized) ||
    normalized.includes('\0') ||
    normalized.split('/').some(segment => segment === '..')
  )
    throw new PluginManifestError(`${path} must be a safe relative path`)
  const result = normalized
    .split('/')
    .filter(segment => segment && segment !== '.')
    .join('/')
  if (!result) throw new PluginManifestError(`${path} must be a safe relative path`)
  return result
}

export const parsePluginManifest = (value: unknown): PluginManifest => {
  const manifest = parseManifest(value)
  for (const entry of [manifest.client?.entry, manifest.server?.entry]) {
    if (entry) safePluginPath(entry, 'manifest entry')
  }
  for (const resource of manifest.resources) {
    safePluginPath(resource.path, 'resource path')
    for (const imported of resource.imports) safePluginPath(imported, 'resource import')
  }
  if (manifest.icon) {
    if (/^[a-z][a-z\d+.-]*:/i.test(manifest.icon)) {
      const url = new URL(manifest.icon)
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new PluginManifestError('icon must be a credential-free HTTP(S) URL')
      }
    } else safePluginPath(manifest.icon, 'icon path')
  }
  return manifest
}

export const isPluginManifestCompatible = (manifest: PluginManifest, coreVersion: string) => {
  try {
    assertPluginManifestCompatible(manifest, { apiVersion: coreVersion })
    return true
  } catch {
    return false
  }
}

export const assertArtifactManifestCompatible = (
  manifest: PluginManifest,
  compatibility: PluginManifestCompatibility,
) => assertPluginManifestCompatible(manifest, compatibility)