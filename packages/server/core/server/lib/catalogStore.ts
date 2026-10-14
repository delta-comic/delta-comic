import {
  parsePluginCatalogIndex,
  PluginCatalogConflictError,
  type PluginCatalogIndex,
  type PluginCatalogStore,
} from './catalogProtocol/index.js'

export interface PluginCatalogObject {
  httpEtag: string
  text(): Promise<string>
}

export interface PluginCatalogBucket {
  get(key: string): Promise<PluginCatalogObject | null>
  put(
    key: string,
    value: string,
    options?: { httpMetadata?: { contentType?: string }; onlyIf?: Headers },
  ): Promise<{ httpEtag: string } | null>
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
  async loadSnapshot() {
    const object = await bucket.get(key)
    if (!object) return { index: undefined, version: null }
    return {
      index: parsePluginCatalogIndex(JSON.parse(await object.text())),
      version: object.httpEtag,
    }
  },
  async save(index: PluginCatalogIndex, expectedVersion) {
    const result = await bucket.put(key, JSON.stringify(parsePluginCatalogIndex(index)), {
      httpMetadata: { contentType: 'application/json' },
      ...(expectedVersion === undefined
        ? {}
        : {
            onlyIf: new Headers(
              expectedVersion === null ? { 'if-none-match': '*' } : { 'if-match': expectedVersion },
            ),
          }),
    })
    if (result === null) throw new PluginCatalogConflictError()
  },
})