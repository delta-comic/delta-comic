import type { AwesomeRegistryIndex, AwesomeRegistryPage, MarketplaceStorage } from './types'
import { parseAwesomeRegistryIndex, parseAwesomeRegistryPage } from './validation'

interface CacheEnvelope {
  cachedAt: string
  data: unknown
}

const parseEnvelope = (value: string): CacheEnvelope | undefined => {
  try {
    const envelope = JSON.parse(value) as Partial<CacheEnvelope>
    if (typeof envelope.cachedAt !== 'string' || !('data' in envelope)) return undefined
    return { cachedAt: envelope.cachedAt, data: envelope.data }
  } catch {
    return undefined
  }
}

export class AwesomeRegistryCache {
  public constructor(
    private readonly storage?: MarketplaceStorage,
    private readonly prefix = 'delta-comic:awesome-registry:v1',
  ) {}

  public readIndex() {
    return this.read(`${this.prefix}:index`, parseAwesomeRegistryIndex)
  }

  public writeIndex(data: AwesomeRegistryIndex) {
    return this.write(`${this.prefix}:index`, data)
  }

  public readPage(path: string) {
    return this.read(`${this.prefix}:page:${path}`, parseAwesomeRegistryPage)
  }

  public writePage(path: string, data: AwesomeRegistryPage) {
    return this.write(`${this.prefix}:page:${path}`, data)
  }

  private read<T>(key: string, parse: (value: unknown) => T) {
    if (!this.storage) return undefined
    let stored: string | null
    try {
      stored = this.storage.getItem(key)
    } catch {
      return undefined
    }
    if (!stored) return undefined
    const envelope = parseEnvelope(stored)
    if (!envelope) {
      this.remove(key)
      return undefined
    }
    try {
      return { cachedAt: envelope.cachedAt, data: parse(envelope.data) }
    } catch {
      this.remove(key)
      return undefined
    }
  }

  private remove(key: string) {
    try {
      this.storage?.removeItem(key)
    } catch {}
  }

  private write(key: string, data: AwesomeRegistryIndex | AwesomeRegistryPage) {
    const cachedAt = new Date().toISOString()
    try {
      this.storage?.setItem(key, JSON.stringify({ cachedAt, data } satisfies CacheEnvelope))
    } catch {}
    return cachedAt
  }
}