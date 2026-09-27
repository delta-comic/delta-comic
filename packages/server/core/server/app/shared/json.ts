type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike }

const normalize = (value: unknown): JsonLike => {
  if (value === null) return null
  const type = typeof value
  if (type === 'string' || type === 'boolean') return value as JsonLike
  if (type === 'number') {
    if (!Number.isFinite(value as number)) return null
    return value as JsonLike
  }
  if (Array.isArray(value)) return value.map(normalize)
  if (type === 'object') {
    const source = value as Record<string, unknown>
    const output: Record<string, JsonLike> = {}
    for (const key of Object.keys(source).sort()) {
      const current = source[key]
      if (current !== undefined) output[key] = normalize(current)
    }
    return output
  }
  return null
}

export const stableStringify = (value: unknown): string => JSON.stringify(normalize(value))

export const parseJson = <T>(value: string | null | undefined): T | undefined => {
  if (value === null || value === undefined) return undefined
  return JSON.parse(value) as T
}