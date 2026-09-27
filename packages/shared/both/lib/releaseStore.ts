import { parsePluginCatalogIndex, type PluginCatalogIndex } from './release.js'

export interface PluginCatalogStore {
  load(): Promise<PluginCatalogIndex | undefined>
  save(index: PluginCatalogIndex): Promise<void>
}

export const createMemoryPluginCatalogStore = (
  initial?: PluginCatalogIndex,
): PluginCatalogStore => {
  let current = initial
  return {
    async load() {
      return current
    },
    async save(index) {
      current = parsePluginCatalogIndex(index)
    },
  }
}

export interface PluginCatalogFetchResponse {
  ok: boolean
  status: number
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
  async save(index) {
    const response = await fetcher(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsePluginCatalogIndex(index)),
    })
    if (!response.ok) throw new Error(`catalog update failed: ${response.status}`)
  },
})
