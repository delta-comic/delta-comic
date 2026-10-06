import { sha256Integrity } from '@delta-comic/client-core-plugin-artifact'
import type { PluginArchiveDB } from '@delta-comic/client-data-db'
import type { PluginManifest } from '@delta-comic/shared-plugin-manifest'
import { Context } from 'cordis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import {
  createArtifactModuleGraph,
  parseClientPluginEntry,
  StoredPluginModuleReader,
  type PluginFileStore,
} from '../../../lib'

const NativeBlob = Blob
class ModuleBlob extends NativeBlob {
  readonly source: string
  constructor(parts: BlobPart[], options?: BlobPropertyBag) {
    super(parts, options)
    this.source = parts.filter(part => typeof part === 'string').join('')
  }
}

beforeEach(() => {
  vi.stubGlobal('Blob', ModuleBlob)
  vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => {
    if (!(blob instanceof ModuleBlob)) throw new Error('expected a module blob')
    return `data:text/javascript,${encodeURIComponent(blob.source)}#${crypto.randomUUID()}`
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const artifact = async (source: string, css = '') => {
  const files = new Map([['index.js', new TextEncoder().encode(source)]])
  if (css) files.set('index.css', new TextEncoder().encode(css))
  const manifest: PluginManifest = {
    protocolVersion: 2,
    id: 'reader',
    name: 'Reader',
    version: '1.0.0',
    client: { entry: 'index.js' },
    resources: await Promise.all(
      [...files].map(async ([path, bytes]) => ({
        path,
        mimeType: path.endsWith('.css') ? 'text/css' : 'text/javascript',
        integrity: await sha256Integrity(bytes),
        imports: [],
      })),
    ),
  }
  const archive: PluginArchiveDB.Archive = {
    displayName: 'Reader',
    enable: true,
    config: {},
    installerName: 'local',
    installInput: '',
    loaderName: 'zip',
    meta: manifest,
    pluginName: 'reader',
  }
  const store: PluginFileStore = {
    read: async (_plugin, path) => {
      const bytes = files.get(path)
      if (!bytes) throw new Error(path)
      return bytes
    },
    release: vi.fn(),
    createAssetUrl: vi.fn(),
    createModuleUrl: vi.fn(),
    replace: vi.fn(),
    remove: vi.fn(),
  }
  return { archive, store }
}

describe('native module reader', () => {
  it('loads a function array and owns URLs until disposal', async () => {
    const { archive, store } = await artifact('export default [function reader() {}]')
    const module = await new StoredPluginModuleReader(store).read(
      archive,
      new AbortController().signal,
    )
    expect(module.functions).toHaveLength(1)
    expect(module.functions[0].name).toBe('reader')
    await module.dispose?.()
    expect(store.release).toHaveBeenCalledWith('reader')
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
  })

  it('validates function-array entries', () => {
    expect(parseClientPluginEntry([() => {}], 'reader')).toHaveLength(1)
    expect(() => parseClientPluginEntry([1], 'reader')).toThrow('function array')
  })

  it('binds CSS to the package fiber', async () => {
    const { archive, store } = await artifact('export default []', '.reader { color: red }')
    const style = { dataset: {}, textContent: '', remove: vi.fn() }
    const append = vi.fn()
    vi.stubGlobal('document', { createElement: () => style, head: { append } })
    const module = await new StoredPluginModuleReader(store).read(
      archive,
      new AbortController().signal,
    )
    const root = new Context()
    const fiber = await root.plugin(ctx => {
      module.activate?.(ctx)
    })
    expect(append).toHaveBeenCalledWith(style)
    expect(style.textContent).toBe('.reader { color: red }')
    await fiber.dispose()
    expect(style.remove).toHaveBeenCalledOnce()
    await module.dispose?.()
    await root.fiber.dispose()
  })

  it('rewrites nested static and dynamic import graphs', async () => {
    const files = new Map([
      [
        'index.js',
        new TextEncoder().encode(
          "export default async () => (await import('./chunks/middle.js')).value",
        ),
      ],
      ['chunks/middle.js', new TextEncoder().encode("export { value } from './value.js'")],
      ['chunks/value.js', new TextEncoder().encode('export const value = 42')],
    ])
    const manifest: PluginManifest = {
      protocolVersion: 2,
      id: 'graph',
      name: 'Graph',
      version: '1.0.0',
      client: { entry: 'index.js' },
      resources: await Promise.all(
        [...files].map(async ([path, bytes]) => ({
          path,
          mimeType: 'text/javascript',
          integrity: await sha256Integrity(bytes),
          imports:
            path === 'index.js'
              ? ['chunks/middle.js']
              : path === 'chunks/middle.js'
                ? ['chunks/value.js']
                : [],
        })),
      ),
    }
    const graph = await createArtifactModuleGraph(manifest, files)
    const module = await import(/* @vite-ignore */ graph.url)
    expect(await module.default()).toBe(42)
    graph.dispose()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3)
  })
})