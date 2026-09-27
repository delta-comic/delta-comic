type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike }

const textEncoder = new TextEncoder()

const normalize = (value: unknown): JsonLike => {
  if (value === null) return null
  const type = typeof value
  if (type === 'string' || type === 'boolean') return value as JsonLike
  if (type === 'number') return Number.isFinite(value) ? (value as JsonLike) : null
  if (Array.isArray(value)) return value.map(normalize)
  if (type === 'object') {
    const output: Record<string, JsonLike> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const current = (value as Record<string, unknown>)[key]
      if (current !== undefined) output[key] = normalize(current)
    }
    return output
  }
  return null
}

export const stableStringify = (value: unknown): string => JSON.stringify(normalize(value))

export const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')

export const sha256Hex = async (input: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(input))
  return bytesToHex(new Uint8Array(digest))
}

export const hashJson = async (value: unknown): Promise<string> => sha256Hex(stableStringify(value))