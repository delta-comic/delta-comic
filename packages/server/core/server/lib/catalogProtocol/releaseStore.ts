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
  loadSnapshot(): Promise<PluginCatalogSnapshot>
  /** `expectedVersion` is enforced atomically; `undefined` writes unconditionally. */
  save(index: PluginCatalogIndex, expectedVersion?: string | null): Promise<void>
}

export const createMemoryPluginCatalogStore = (
  initial?: PluginCatalogIndex,
): PluginCatalogStore => {
  let current = initial && structuredClone(parsePluginCatalogIndex(initial))
  let revision = 0
  return {
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