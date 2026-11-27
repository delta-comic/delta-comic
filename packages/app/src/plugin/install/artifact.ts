import { parsePluginManifest, type PluginManifest } from '@delta-comic/platform/manifest'

export interface ArtifactFile {
  path: string
  bytes: Uint8Array
}

export interface PluginArtifact {
  manifest: PluginManifest
  files: readonly ArtifactFile[]
}

export interface ArtifactValidationResult {
  manifest: PluginManifest
  files: readonly ArtifactFile[]
  entryModule: ArtifactFile
}

export class ArtifactValidationError extends Error {
  public constructor(message: string) {
    super(`Invalid plugin artifact: ${message}`)
    this.name = 'ArtifactValidationError'
  }
}

const normalizePath = (path: string) => {
  const normalized = path.replaceAll('\\', '/')
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.includes('\0') ||
    /^[a-z]:($|\/)/i.test(normalized) ||
    normalized.split('/').some(segment => segment === '..')
  )
    throw new ArtifactValidationError(`unsafe relative path: ${path}`)
  const result = normalized
    .split('/')
    .filter(segment => segment && segment !== '.')
    .join('/')
  if (!result) throw new ArtifactValidationError(`empty relative path: ${path}`)
  return result
}

const toBase64 = (bytes: Uint8Array) => {
  if (typeof btoa === 'function') {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    result += alphabet[first >> 2]
    result += alphabet[((first & 3) << 4) | (second === undefined ? 0 : second >> 4)]
    result +=
      second === undefined
        ? '='
        : alphabet[((second & 15) << 2) | (third === undefined ? 0 : third >> 6)]
    result += third === undefined ? '=' : alphabet[third & 63]
  }
  return result
}

const digest = async (bytes: Uint8Array) => {
  const hash = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))
  return `sha256-${toBase64(new Uint8Array(hash))}`
}

export const validateArtifact = async (
  artifact: PluginArtifact,
): Promise<ArtifactValidationResult> => {
  const manifest = parsePluginManifest(artifact.manifest)
  const resources = new Map(manifest.resources.map(r => [r.path, r]))
  const files = new Map<string, ArtifactFile>()
  for (const file of artifact.files) {
    const path = normalizePath(file.path)
    if (files.has(path)) throw new ArtifactValidationError(`duplicate file: ${path}`)
    if (path !== 'manifest.json' && !resources.has(path))
      throw new ArtifactValidationError(`undeclared resource: ${path}`)
    files.set(path, { path, bytes: file.bytes })
  }
  for (const [path, resource] of resources) {
    const file = files.get(path)
    if (!file) throw new ArtifactValidationError(`resource is missing: ${path}`)
    if ((await digest(file.bytes)) !== resource.integrity) {
      throw new ArtifactValidationError(`integrity mismatch: ${path}`)
    }
  }
  const entryModule = files.get(normalizePath(manifest.script))
  if (!entryModule) throw new ArtifactValidationError(`entry module is missing: ${manifest.script}`)
  return { manifest, files: [...files.values()], entryModule }
}

export const sha256Integrity = digest