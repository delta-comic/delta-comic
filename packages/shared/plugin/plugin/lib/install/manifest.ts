import { DELTA_COMIC_PLUGIN_API_VERSION, type PluginManifest } from '@delta-comic/model'
import semver from 'semver'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const record = (value: unknown, path: string) => {
  if (!isRecord(value)) throw new PluginManifestError(`${path} must be an object`)
  return value
}

const text = (value: unknown, path: string) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new PluginManifestError(`${path} must be a non-empty string`)
  }
  return value
}

const pluginId = (value: unknown, path: string) => {
  const id = text(value, path)
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id)) {
    throw new PluginManifestError(`${path} must be a portable 1-64 character plugin identifier`)
  }
  return id
}

export const safePluginPath = (value: unknown, path: string) => {
  const normalized = text(value, path).replaceAll('\\', '/')
  if (
    normalized.startsWith('/') ||
    /^[a-z]:($|\/)/i.test(normalized) ||
    normalized.includes('\0') ||
    normalized.split('/').some(segment => segment === '..')
  ) {
    throw new PluginManifestError(`${path} must be a safe relative path`)
  }
  return normalized
    .split('/')
    .filter(segment => segment && segment !== '.')
    .join('/')
}

export class PluginManifestError extends Error {
  public constructor(message: string) {
    super(`Invalid Delta Comic manifest: ${message}`)
    this.name = 'PluginManifestError'
  }
}

const pluginIcon = (value: unknown) => {
  const icon = text(value, 'manifest.icon').trim()
  if (!/^[a-z][a-z\d+.-]*:/i.test(icon)) return safePluginPath(icon, 'manifest.icon')
  let url: URL
  try {
    url = new URL(icon)
  } catch {
    throw new PluginManifestError('manifest.icon must be an HTTP(S) URL or a safe relative path')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new PluginManifestError(
      'manifest.icon must be a credential-free HTTP(S) URL or a safe relative path',
    )
  }
  return icon
}

export const parsePluginManifest = (value: unknown): PluginManifest => {
  const manifest = record(value, 'manifest')
  if (manifest.apiVersion !== DELTA_COMIC_PLUGIN_API_VERSION) {
    throw new PluginManifestError(`manifest.apiVersion must be ${DELTA_COMIC_PLUGIN_API_VERSION}`)
  }
  const name = record(manifest.name, 'manifest.name')
  const version = record(manifest.version, 'manifest.version')
  const id = pluginId(name.id, 'manifest.name.id')
  if (!Array.isArray(manifest.require)) {
    throw new PluginManifestError('manifest.require must be an array')
  }

  const result: PluginManifest = {
    apiVersion: DELTA_COMIC_PLUGIN_API_VERSION,
    author: text(manifest.author, 'manifest.author'),
    description: text(manifest.description, 'manifest.description'),
    name: { display: text(name.display, 'manifest.name.display'), id },
    require: manifest.require.map((value, index) => {
      const dependency = record(value, `manifest.require[${index}]`)
      return {
        id: pluginId(dependency.id, `manifest.require[${index}].id`),
        ...(dependency.download === undefined
          ? {}
          : { download: text(dependency.download, `manifest.require[${index}].download`) }),
      }
    }),
    version: {
      plugin: text(version.plugin, 'manifest.version.plugin'),
      supportCore: text(version.supportCore, 'manifest.version.supportCore'),
    },
  }

  if (manifest.icon !== undefined) result.icon = pluginIcon(manifest.icon)
  if (manifest.integrity !== undefined) {
    const integrity = record(manifest.integrity, 'manifest.integrity')
    if (integrity.algorithm !== 'blake3' && integrity.algorithm !== 'sha256') {
      throw new PluginManifestError('manifest.integrity.algorithm is unsupported')
    }
    result.integrity = {
      algorithm: integrity.algorithm,
      digest: text(integrity.digest, 'manifest.integrity.digest'),
    }
  }
  return result
}

export const isPluginManifestCompatible = (manifest: PluginManifest, coreVersion: string) =>
  semver.satisfies(coreVersion, manifest.version.supportCore)