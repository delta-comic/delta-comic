import type { PluginArchiveDB } from '@delta-comic/db'
import semver from 'semver'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const requiredRecord = (value: unknown, path: string) => {
  if (!isRecord(value)) throw new PluginManifestError(`${path} must be an object`)
  return value
}

const requiredString = (value: unknown, path: string) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new PluginManifestError(`${path} must be a non-empty string`)
  }
  return value
}

const optionalPath = (value: unknown, path: string) => {
  const text = requiredString(value, path)
  const normalized = text.replaceAll('\\', '/')
  if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new PluginManifestError(`${path} must be a safe relative path`)
  }
  return text
}

export type PluginIconReference =
  | { type: 'local'; path: string; fragment: string }
  | { type: 'remote'; url: string }

const decodeLocalIconPath = (value: string, path: string) => {
  let decoded = value
  for (let index = 0; index < 5; index += 1) {
    let next: string
    try {
      next = decodeURIComponent(decoded)
    } catch {
      throw new PluginManifestError(`${path} must be a valid URL path`)
    }
    if (next === decoded) break
    decoded = next
  }

  const normalized = decoded.replaceAll('\\', '/')
  const segments = normalized.split('/')
  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[a-z]:($|\/)/i.test(normalized) ||
    normalized.includes('\0') ||
    segments.some(segment => segment === '..')
  ) {
    throw new PluginManifestError(`${path} must be a safe relative path`)
  }
  return segments.filter(segment => segment && segment !== '.').join('/')
}

/**
 * Accepts a credential-free HTTP(S) URL or a safe path inside the plugin archive.
 * Query strings and fragments are kept for both forms.
 */
export const parsePluginIconReference = (
  value: unknown,
  path = 'manifest.icon',
): PluginIconReference => {
  const text = requiredString(value, path).trim()
  if (!text) throw new PluginManifestError(`${path} must be a non-empty string`)

  if (/^[a-z][a-z\d+.-]*:/i.test(text) || text.startsWith('//')) {
    let url: URL
    try {
      url = new URL(text)
    } catch {
      throw new PluginManifestError(`${path} must be an HTTP(S) URL or a safe relative path`)
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new PluginManifestError(
        `${path} must be a credential-free HTTP(S) URL or a safe relative path`,
      )
    }
    return { type: 'remote', url: text }
  }

  const rawPath = text.split(/[?#]/, 1)[0] ?? ''
  const resolvedPath = decodeLocalIconPath(rawPath, path)
  if (!resolvedPath) throw new PluginManifestError(`${path} must be a safe relative path`)

  const fragmentIndex = text.indexOf('#')
  return {
    fragment: fragmentIndex < 0 ? '' : text.slice(fragmentIndex),
    path: resolvedPath,
    type: 'local',
  }
}

export class PluginManifestError extends Error {
  public constructor(message: string) {
    super(`Invalid Delta Comic manifest: ${message}`)
    this.name = 'PluginManifestError'
  }
}

/**
 * Validates the exact manifest format emitted by the `deltaComic` Vite plugin.
 * The returned value is safe to use as the persisted plugin metadata shape.
 */
export const parsePluginManifest = (value: unknown): PluginArchiveDB.Meta => {
  const manifest = requiredRecord(value, 'manifest')
  const name = requiredRecord(manifest.name, 'manifest.name')
  const version = requiredRecord(manifest.version, 'manifest.version')
  const id = requiredString(name.id, 'manifest.name.id')
  if (id === '.' || id === '..' || /[\\/]/.test(id)) {
    throw new PluginManifestError('manifest.name.id contains an unsafe path segment')
  }

  const requireValue = manifest.require
  if (!Array.isArray(requireValue)) {
    throw new PluginManifestError('manifest.require must be an array')
  }
  const require = requireValue.map((dependency, index) => {
    const record = requiredRecord(dependency, `manifest.require[${index}]`)
    const download = record.download
    if (download !== undefined && typeof download !== 'string') {
      throw new PluginManifestError(`manifest.require[${index}].download must be a string`)
    }
    return {
      id: requiredString(record.id, `manifest.require[${index}].id`),
      ...(download === undefined ? {} : { download }),
    }
  })

  const result: PluginArchiveDB.Meta = {
    author: requiredString(manifest.author, 'manifest.author'),
    description: requiredString(manifest.description, 'manifest.description'),
    name: { display: requiredString(name.display, 'manifest.name.display'), id },
    require,
    version: {
      plugin: requiredString(version.plugin, 'manifest.version.plugin'),
      supportCore: requiredString(version.supportCore, 'manifest.version.supportCore'),
    },
  }

  if (manifest.icon !== undefined) {
    const icon = parsePluginIconReference(manifest.icon)
    result.icon =
      icon.type === 'remote' ? icon.url : requiredString(manifest.icon, 'manifest.icon').trim()
  }

  if (manifest.entry !== undefined) {
    const entry = requiredRecord(manifest.entry, 'manifest.entry')
    result.entry = {
      jsPath: optionalPath(entry.jsPath, 'manifest.entry.jsPath'),
      ...(entry.cssPath === undefined
        ? {}
        : { cssPath: optionalPath(entry.cssPath, 'manifest.entry.cssPath') }),
    }
  }

  if (manifest.kind !== undefined) {
    if (manifest.kind !== 'normal' && manifest.kind !== 'preboot') {
      throw new PluginManifestError('manifest.kind must be "normal" or "preboot"')
    }
    result.kind = manifest.kind
  }

  if (manifest.integrity !== undefined) {
    const integrity = requiredRecord(manifest.integrity, 'manifest.integrity')
    if (integrity.algorithm !== 'blake3' && integrity.algorithm !== 'sha256') {
      throw new PluginManifestError('manifest.integrity.algorithm is unsupported')
    }
    result.integrity = {
      algorithm: integrity.algorithm,
      digest: requiredString(integrity.digest, 'manifest.integrity.digest'),
    }
  }

  return result
}

export const isPluginManifestCompatible = (manifest: PluginArchiveDB.Meta, coreVersion: string) =>
  semver.satisfies(coreVersion, manifest.version.supportCore)