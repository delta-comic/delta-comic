import {
  parsePluginCatalogIndex,
  type PluginCatalogIndex,
  type PluginCatalogStore,
} from '@delta-comic/both'

export interface PluginCatalogObject {
  text(): Promise<string>
}

export interface PluginCatalogBucket {
  get(key: string): Promise<PluginCatalogObject | null>
  put(
    key: string,
    value: string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<void>
}

export const createR2PluginCatalogStore = (
  bucket: PluginCatalogBucket,
  key = 'catalog/index.json',
): PluginCatalogStore => ({
  async load() {
    const object = await bucket.get(key)
    if (!object) return undefined
    return parsePluginCatalogIndex(JSON.parse(await object.text()))
  },
  async save(index: PluginCatalogIndex) {
    await bucket.put(key, JSON.stringify(parsePluginCatalogIndex(index)), {
      httpMetadata: { contentType: 'application/json' },
    })
  },
})