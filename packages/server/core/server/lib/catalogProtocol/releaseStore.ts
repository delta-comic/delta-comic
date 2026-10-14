import { parsePluginCatalogIndex, type PluginCatalogIndex } from './release.js'

export type PluginCatalogSnapshot =
  | { index: PluginCatalogIndex; version: string }
  | { index: undefined; version: null }

export class PluginCatalogConflictError extends Error {
  constructor() {
    super('Plugin catalog changed; reload and retry')
    this.name = 'PluginCatalogConflictError'
  }
}

export interface PluginCatalogStore {
  load(): Promise<PluginCatalogIndex | undefined>
  save(index: PluginCatalogIndex, expectedVersion?: string | null): Promise<void>
  /** Stores providing snapshots enforce expectedVersion atomically on save. */
  loadSnapshot?(): Promise<PluginCatalogSnapshot>
}

export const createMemoryPluginCatalogStore = (
  initial?: PluginCatalogIndex,
): PluginCatalogStore => {
  let current = initial ? structuredClone(parsePluginCatalogIndex(initial)) : undefined
  let revision = 0
  return {
    async load() {
      return structuredClone(current)
    },
    async loadSnapshot() {
      return current
        ? { index: structuredClone(current), version: `"${revision}"` }
        : { index: undefined, version: null }
    },
    async save(index, expectedVersion) {
      if (expectedVersion !== undefined && expectedVersion !== (current ? `"${revision}"` : null)) {
        throw new PluginCatalogConflictError()
      }
      current = structuredClone(parsePluginCatalogIndex(index))
      revision++
    },
  }
}

export interface PluginCatalogFetchResponse {
  ok: boolean
  status: number
  headers?: Pick<Headers, 'get'>
  json(): Promise<unknown>
}

export interface PluginCatalogFetcher {
  (input: string, init?: RequestInit): Promise<PluginCatalogFetchResponse>
}

export const createHttpPluginCatalogStore = (
  url: string,
  fetcher: PluginCatalogFetcher = globalThis.fetch,
): PluginCatalogStore => ({
  async load() {
    const response = await fetcher(url, { headers: { accept: 'application/json' } })
    if (response.status === 404) return undefined
    if (!response.ok) throw new Error(`catalog request failed: ${response.status}`)
    return parsePluginCatalogIndex(await response.json())
  },
  async loadSnapshot() {
    const response = await fetcher(url, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
    if (response.status === 404) return { index: undefined, version: null }
    if (!response.ok) throw new Error(`catalog request failed: ${response.status}`)
    const version = response.headers?.get('etag')
    if (!version) throw new Error('catalog snapshot is missing ETag')
    return { index: parsePluginCatalogIndex(await response.json()), version }
  },
  async save(index, expectedVersion) {
    const response = await fetcher(url, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        ...(expectedVersion === undefined
          ? {}
          : expectedVersion === null
            ? { 'if-none-match': '*' }
            : { 'if-match': expectedVersion }),
      },
      body: JSON.stringify(parsePluginCatalogIndex(index)),
    })
    if (response.status === 412) throw new PluginCatalogConflictError()
    if (!response.ok) throw new Error(`catalog update failed: ${response.status}`)
  },
})