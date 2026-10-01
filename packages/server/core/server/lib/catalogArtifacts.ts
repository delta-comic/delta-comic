import type { PluginReleaseArtifact } from '@delta-comic/both'

const pathSegment = /^[A-Za-z0-9._-]+$/

export interface PluginArtifactBucket {
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string }; onlyIf?: Headers },
  ): Promise<unknown>
}

export class PluginArtifactConflictError extends Error {
  public constructor() {
    super('plugin artifact already exists; choose a new version')
    this.name = 'PluginArtifactConflictError'
  }
}

export interface PluginArtifactUpload {
  pluginId: string
  version: string
  platform: string
  mimeType: string
  body: ArrayBuffer
}

export interface PluginArtifactStore {
  upload(input: PluginArtifactUpload): Promise<PluginReleaseArtifact>
}

const encodeBase64 = (bytes: Uint8Array): string => {
  let value = ''
  for (const byte of bytes) value += String.fromCharCode(byte)
  return btoa(value)
}

const sha256 = async (body: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', body)
  return `sha256-${encodeBase64(new Uint8Array(digest))}`
}

const assertSegment = (label: string, value: string): void => {
  if (!pathSegment.test(value)) throw new TypeError(`${label} contains invalid path characters`)
}

export const createR2PluginArtifactStore = (
  bucket: PluginArtifactBucket,
  publicBaseUrl: string,
  prefix = 'artifacts',
): PluginArtifactStore => {
  const baseUrl = new URL(publicBaseUrl)
  if (baseUrl.protocol !== 'https:') throw new TypeError('artifact base URL must use HTTPS')

  return {
    async upload(input) {
      assertSegment('pluginId', input.pluginId)
      assertSegment('version', input.version)
      assertSegment('platform', input.platform)
      if (!input.mimeType.trim()) throw new TypeError('artifact mimeType is required')
      if (input.body.byteLength === 0) throw new TypeError('artifact body is empty')

      const integrity = await sha256(input.body)
      const key = `${prefix}/${input.pluginId}/${input.version}/${input.platform}.zip`
      const result = await bucket.put(key, input.body, {
        httpMetadata: { contentType: input.mimeType },
        onlyIf: new Headers({ 'if-none-match': '*' }),
      })
      if (result === null) throw new PluginArtifactConflictError()
      const url = new URL(key, `${baseUrl.toString().replace(/\/$/, '')}/`).toString()
      return {
        integrity,
        mimeType: input.mimeType,
        platform: input.platform,
        size: input.body.byteLength,
        url,
      }
    },
  }
}