import JSZip from 'jszip'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

const nativeMocks = vi.hoisted(() => ({
  appLocalDataDir: vi.fn(async () => '/app-data'),
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
  createNativeOperationId: vi.fn(() => 'native-operation'),
  exists: vi.fn(async () => true),
  installZip: vi.fn(),
  invoke: vi.fn(),
  isTauri: vi.fn(() => false),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  readDir: vi.fn(),
  readFile: vi.fn(),
  remove: vi.fn(),
  writeNativeTempFile: vi.fn(async () => '/tmp/plugin.zip'),
}))

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: nativeMocks.convertFileSrc,
  invoke: nativeMocks.invoke,
  isTauri: nativeMocks.isTauri,
}))
vi.mock('@tauri-apps/api/path', () => ({
  appLocalDataDir: nativeMocks.appLocalDataDir,
  join: nativeMocks.join,
}))
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: nativeMocks.exists,
  readDir: nativeMocks.readDir,
  readFile: nativeMocks.readFile,
  remove: nativeMocks.remove,
}))
vi.mock('./native', () => ({
  createNativeOperationId: nativeMocks.createNativeOperationId,
  installZip: nativeMocks.installZip,
  writeNativeTempFile: nativeMocks.writeNativeTempFile,
}))

import {
  decodeDevMetaFromCode,
  digestPluginBytes,
  createPluginAssetUrl,
  createPluginModuleUrl,
  installDevCode,
  installZipFile,
  listPluginFiles,
  readPluginFile,
  readPluginText,
  releasePluginObjectUrls,
  removePluginFiles,
} from './storage'

const meta = {
  author: 'Delta Comic',
  description: 'web plugin',
  name: { display: 'Web plugin', id: 'web-plugin' },
  require: [],
  version: { plugin: '1.0.0', supportCore: '*' },
}

const code = `// ==UserScript==
// @description ${JSON.stringify(meta)}
// ==/UserScript==
export default () => ({ name: 'web-plugin' })`

const createCode = (pluginId: string, version: string) => {
  const pluginMeta = {
    ...meta,
    name: { display: pluginId, id: pluginId },
    version: { ...meta.version, plugin: version },
  }
  return `// ==UserScript==
// @description ${JSON.stringify(pluginMeta)}
// ==/UserScript==
export default ${JSON.stringify(version)}`
}

type FailureEvent = 'abort' | 'error'

const createControlledIndexedDb = (storedKeys: IDBValidKey[] = []) => {
  let putCount = 0
  let requestCount = 0
  let transaction: (Omit<IDBTransaction, 'error'> & { error: DOMException | null }) | undefined

  const createRequest = <T>(result: T): IDBRequest<T> => {
    const request = { error: null, result } as IDBRequest<T>
    requestCount += 1
    queueMicrotask(() => request.onsuccess?.(new Event('success')))
    return request
  }

  const store = {
    delete: () => createRequest(undefined),
    get: () => createRequest(undefined),
    getAllKeys: () => createRequest(storedKeys),
    openKeyCursor: () => createRequest<IDBCursor | null>(null),
    put: () => {
      putCount += 1
      return createRequest(undefined)
    },
  } as unknown as IDBObjectStore

  const database = {
    close: vi.fn(),
    transaction: () => {
      transaction = {
        abort: () => transaction?.onabort?.(new Event('abort')),
        error: null,
        objectStore: () => store,
      } as unknown as Omit<IDBTransaction, 'error'> & { error: DOMException | null }
      return transaction
    },
  } as unknown as IDBDatabase

  const factory = {
    open: () => {
      const request = { error: null } as IDBOpenDBRequest
      queueMicrotask(() => {
        Object.defineProperty(request, 'result', { value: database })
        request.onsuccess?.(new Event('success'))
      })
      return request
    },
  } as unknown as IDBFactory

  vi.stubGlobal('indexedDB', factory)

  return {
    complete: () => transaction?.oncomplete?.(new Event('complete')),
    fail: (event: FailureEvent) => {
      if (!transaction) throw new Error('transaction has not started')
      transaction.error = new DOMException(`test transaction ${event}`, event)
      transaction[`on${event}`]?.(new Event(event))
    },
    get putCount() {
      return putCount
    },
    get requestCount() {
      return requestCount
    },
  }
}

afterEach(() => {
  nativeMocks.isTauri.mockReset().mockReturnValue(false)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('browser plugin storage', () => {
  it('fingerprints plugin bytes through Rust WASM or the Web Crypto fallback', async () => {
    const bytes = new TextEncoder().encode('delta-comic-plugin')
    const first = await digestPluginBytes(bytes)
    const second = await digestPluginBytes(bytes)

    expect(['blake3', 'sha256']).toContain(first.algorithm)
    expect(first.digest).toMatch(/^[a-f\d]{64}$/)
    expect(second).toEqual(first)
  })

  it('decodes userscript metadata without native IPC', () => {
    expect(decodeDevMetaFromCode(code)).toEqual(meta)
    expect(() => decodeDevMetaFromCode('export default {}')).toThrow(
      'not found @description metadata',
    )
    expect(() => decodeDevMetaFromCode('// @description {invalid-json}')).toThrow(SyntaxError)
  })

  it('stores development plugins in the browser fallback', async () => {
    await installDevCode(code)

    expect(await readPluginText('web-plugin', 'us.js')).toBe(code)
  })

  it('creates typed browser URLs and releases only the tracked asset URLs', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:module')
      .mockReturnValueOnce('blob:asset')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    await installDevCode(code)

    await expect(createPluginModuleUrl('web-plugin', 'us.js')).resolves.toBe('blob:module')
    await expect(createPluginAssetUrl('web-plugin', 'us.js')).resolves.toBe('blob:asset')
    expect(createObjectURL.mock.calls[1]?.[0]).toMatchObject({ type: 'application/octet-stream' })

    releasePluginObjectUrls('web-plugin')
    releasePluginObjectUrls('web-plugin')
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:asset')
  })

  it('removes all browser files and rejects subsequent reads', async () => {
    vi.stubGlobal('indexedDB', undefined)
    await installDevCode(code)

    await removePluginFiles('web-plugin')

    await expect(listPluginFiles('web-plugin')).resolves.toEqual([])
    await expect(readPluginFile('web-plugin', '/us.js')).rejects.toThrow(
      'plugin file not found: web-plugin//us.js',
    )
  })

  it('rejects plugin ids that could escape their storage namespace', async () => {
    const invalid = code.replace('"web-plugin"', '"../outside"')
    expect(() => decodeDevMetaFromCode(invalid)).not.toThrow()
    await expect(installDevCode(invalid)).rejects.toThrow('invalid plugin id')
  })

  it('does not expose a zip update when staging an entry fails', async () => {
    const pluginId = 'zip-staging-plugin'
    const previousCode = createCode(pluginId, '1.0.0')
    await installDevCode(previousCode)

    const archive = new JSZip()
    const nextMeta = decodeDevMetaFromCode(createCode(pluginId, '2.0.0'))
    archive.file('manifest.json', JSON.stringify(nextMeta))
    archive.file('index.mjs', 'export default 2')
    const loaded = await JSZip.loadAsync(await archive.generateAsync({ type: 'uint8array' }))
    vi.spyOn(loaded.file('index.mjs')!, 'async').mockRejectedValue(new Error('extract failed'))
    vi.spyOn(JSZip, 'loadAsync').mockResolvedValue(loaded)

    await expect(installZipFile(new File([], 'plugin.zip'))).rejects.toThrow('extract failed')
    expect(await readPluginText(pluginId, 'us.js')).toBe(previousCode)
    expect(await listPluginFiles(pluginId)).toEqual(['us.js'])
  })

  it('extracts safe zip entries atomically and reports progress', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const archive = new JSZip()
    archive.file('manifest.json', JSON.stringify(meta))
    archive.file('index.mjs', 'export default 1')
    archive.file('images/cover.png', new Uint8Array([1, 2, 3]))
    archive.file('/absolute.js', 'ignored')
    const bytes = await archive.generateAsync({ type: 'uint8array' })
    const progress = vi.fn()

    await expect(
      installZipFile(new File([Uint8Array.from(bytes)], 'plugin.zip'), progress),
    ).resolves.toMatchObject({
      name: { id: 'web-plugin' },
      integrity: { digest: expect.any(String) },
    })

    await expect(listPluginFiles('web-plugin')).resolves.toEqual([
      'manifest.json',
      'index.mjs',
      'images/cover.png',
    ])
    expect(progress).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ current: 0, phase: 'start', total: 4 }),
    )
    expect(progress).toHaveBeenLastCalledWith(
      expect.objectContaining({ current: 4, phase: 'done', total: 4 }),
    )
  })

  it('rejects archives without a manifest before replacing installed files', async () => {
    const archive = new JSZip().file('index.mjs', 'export default 1')
    const bytes = await archive.generateAsync({ type: 'uint8array' })

    await expect(installZipFile(new File([Uint8Array.from(bytes)], 'plugin.zip'))).rejects.toThrow(
      'plugin archive does not contain manifest.json',
    )
  })

  it('waits for the IndexedDB transaction to commit before publishing an update', async () => {
    const pluginId = 'commit-wait-plugin'
    const controlled = createControlledIndexedDb()
    let resolved = false
    const installation = installDevCode(createCode(pluginId, '1.0.0')).then(() => {
      resolved = true
    })

    await vi.waitFor(() => expect(controlled.putCount).toBe(1))
    await Promise.resolve()
    expect(resolved).toBe(false)

    controlled.complete()
    await installation
    expect(resolved).toBe(true)
  })

  it.each<FailureEvent>(['abort', 'error'])(
    'keeps the previous version when an IndexedDB transaction emits %s',
    async failureEvent => {
      const pluginId = `atomic-${failureEvent}-plugin`
      const previousCode = createCode(pluginId, '1.0.0')
      const nextCode = createCode(pluginId, '2.0.0')
      vi.stubGlobal('indexedDB', undefined)
      await installDevCode(previousCode)

      const controlled = createControlledIndexedDb()
      const installation = installDevCode(nextCode)
      const rejection = expect(installation).rejects.toThrow(`test transaction ${failureEvent}`)
      await vi.waitFor(() => expect(controlled.putCount).toBe(1))
      controlled.fail(failureEvent)
      await rejection

      vi.stubGlobal('indexedDB', undefined)
      expect(await readPluginText(pluginId, 'us.js')).toBe(previousCode)
    },
  )

  it('waits for readonly transactions to complete after their request succeeds', async () => {
    const controlled = createControlledIndexedDb(['readonly-plugin/index.mjs'])
    let resolved = false
    const files = listPluginFiles('readonly-plugin').then(result => {
      resolved = true
      return result
    })

    await vi.waitFor(() => expect(controlled.requestCount).toBeGreaterThan(0))
    await Promise.resolve()
    expect(resolved).toBe(false)

    controlled.complete()
    await expect(files).resolves.toEqual(['index.mjs'])
  })
})

describe('native plugin storage bridges', () => {
  const enableTauri = () => nativeMocks.isTauri.mockReturnValue(true)

  it('reads, lists, resolves and removes files through Tauri APIs', async () => {
    enableTauri()
    nativeMocks.readFile.mockResolvedValueOnce(new Uint8Array([65, 66]))
    nativeMocks.readDir.mockResolvedValueOnce([
      { isFile: true, name: 'index.mjs' },
      { isFile: false, name: 'assets' },
    ])

    await expect(readPluginText('native-plugin', 'index.mjs')).resolves.toBe('AB')
    await expect(listPluginFiles('native-plugin')).resolves.toEqual(['index.mjs'])
    await expect(createPluginModuleUrl('native-plugin', 'index.mjs')).resolves.toBe(
      'asset:///app-data/plugin/native-plugin/index.mjs',
    )
    await expect(createPluginAssetUrl('native-plugin', 'cover.png')).resolves.toBe(
      'asset:///app-data/plugin/native-plugin/cover.png',
    )
    await removePluginFiles('native-plugin')

    expect(nativeMocks.readFile).toHaveBeenCalledWith('/app-data/plugin/native-plugin/index.mjs')
    expect(nativeMocks.remove).toHaveBeenCalledWith('/app-data/plugin/native-plugin/', {
      recursive: true,
    })
  })

  it('preserves computed integrity around native development and zip installs', async () => {
    enableTauri()
    nativeMocks.invoke.mockResolvedValueOnce({ ...meta, description: 'native dev' })
    nativeMocks.installZip.mockResolvedValueOnce({ ...meta, description: 'native zip' })
    const progress = vi.fn()
    const file = new File([new Uint8Array([1, 2, 3])], 'plugin.zip')

    await expect(installDevCode(code)).resolves.toMatchObject({
      description: 'native dev',
      integrity: { digest: expect.any(String) },
    })
    await expect(installZipFile(file, progress)).resolves.toMatchObject({
      description: 'native zip',
      integrity: { digest: expect.any(String) },
    })

    expect(nativeMocks.invoke).toHaveBeenCalledWith('plugin:plugin|install_dev', { code })
    expect(nativeMocks.installZip).toHaveBeenCalledWith(
      '/tmp/plugin.zip',
      'native-operation',
      progress,
    )
  })
})