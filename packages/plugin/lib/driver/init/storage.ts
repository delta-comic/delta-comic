import type { PluginArchiveDB } from '@delta-comic/db'
import { isTauri } from '@tauri-apps/api/core'
import JSZip from 'jszip'

import type { NativeInstallProgress } from './native'

const databaseName = 'delta-comic-plugin-files'
const storeName = 'files'
const memoryFiles = new Map<string, Uint8Array>()
const pluginObjectUrls = new Map<string, Set<string>>()

export const isTauriRuntime = isTauri

const fileKey = (pluginId: string, path: string) => `${pluginId}/${path.replace(/^\/+/, '')}`

const openFileDatabase = async (): Promise<IDBDatabase | null> => {
  if (!globalThis.indexedDB) return null
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    let settled = false
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName)
      }
    }
    request.onsuccess = () => {
      if (settled) {
        request.result.close()
        return
      }
      settled = true
      resolve(request.result)
    }
    request.onerror = () => {
      settled = true
      reject(request.error ?? new Error('failed to open plugin file database'))
    }
    request.onblocked = () => {
      settled = true
      reject(new Error('opening plugin file database was blocked'))
    }
  })
}

const getTransactionError = (transaction: IDBTransaction, fallback: string) =>
  transaction.error ?? new Error(fallback)

const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> => {
  let database: IDBDatabase | null = null
  try {
    database = await openFileDatabase()
    if (!database) return undefined
    return await new Promise<T>((resolve, reject) => {
      let transaction: IDBTransaction
      let request: IDBRequest<T>
      let requestCompleted = false
      let requestResult: T
      let requestError: DOMException | null = null
      let settled = false

      const close = () => {
        database?.close()
        database = null
      }
      const fail = (error: unknown) => {
        if (settled) return
        settled = true
        close()
        reject(error)
      }

      try {
        transaction = database!.transaction(storeName, mode)
        request = run(transaction.objectStore(storeName))
      } catch (error) {
        fail(error)
        return
      }

      request.onsuccess = () => {
        requestCompleted = true
        requestResult = request.result
      }
      request.onerror = () => {
        requestError = request.error
      }
      transaction.oncomplete = () => {
        if (settled) return
        settled = true
        close()
        if (!requestCompleted) {
          reject(requestError ?? new Error('IndexedDB request did not complete'))
          return
        }
        resolve(requestResult)
      }
      transaction.onerror = () => {
        fail(requestError ?? getTransactionError(transaction, 'IndexedDB transaction failed'))
      }
      transaction.onabort = () => {
        fail(requestError ?? getTransactionError(transaction, 'IndexedDB transaction aborted'))
      }
    })
  } catch (error) {
    database?.close()
    console.warn('[plugin storage] IndexedDB operation failed, using memory fallback', error)
    return undefined
  }
}

const replaceMemoryPlugin = (pluginId: string, files: ReadonlyMap<string, Uint8Array>) => {
  const prefix = `${pluginId}/`
  for (const key of memoryFiles.keys()) {
    if (key.startsWith(prefix)) memoryFiles.delete(key)
  }
  for (const [path, bytes] of files) {
    memoryFiles.set(fileKey(pluginId, path), bytes)
  }
}

const replacePersistentPlugin = async (
  pluginId: string,
  files: ReadonlyMap<string, Uint8Array>,
): Promise<boolean> => {
  const database = await openFileDatabase()
  if (!database) return false

  return await new Promise<boolean>((resolve, reject) => {
    let transaction: IDBTransaction
    let settled = false
    let operationError: unknown

    const close = () => database.close()
    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      close()
      reject(error)
    }

    try {
      transaction = database.transaction(storeName, 'readwrite')
    } catch (error) {
      close()
      reject(error)
      return
    }

    transaction.oncomplete = () => {
      if (settled) return
      settled = true
      close()
      resolve(true)
    }
    transaction.onerror = () => {
      fail(operationError ?? getTransactionError(transaction, 'plugin update transaction failed'))
    }
    transaction.onabort = () => {
      fail(operationError ?? getTransactionError(transaction, 'plugin update transaction aborted'))
    }

    try {
      const store = transaction.objectStore(storeName)
      const prefix = `${pluginId}/`
      const cursorRequest = store.openKeyCursor()
      cursorRequest.onsuccess = () => {
        try {
          const cursor = cursorRequest.result
          if (cursor) {
            if (String(cursor.key).startsWith(prefix)) store.delete(cursor.key)
            cursor.continue()
            return
          }
          for (const [path, bytes] of files) {
            store.put(bytes, fileKey(pluginId, path))
          }
        } catch (error) {
          operationError = error
          transaction.abort()
        }
      }
      cursorRequest.onerror = () => {
        operationError = cursorRequest.error
      }
    } catch (error) {
      operationError = error
      try {
        transaction.abort()
      } catch {
        fail(error)
      }
    }
  })
}

const replaceWebPlugin = async (pluginId: string, files: ReadonlyMap<string, Uint8Array>) => {
  const persisted = await replacePersistentPlugin(pluginId, files)
  // Every byte is prepared before this synchronous switch. If IndexedDB is available,
  // its transaction has committed at this point; otherwise memory is the storage backend.
  replaceMemoryPlugin(pluginId, files)
  return persisted
}

const readWebFile = async (pluginId: string, path: string): Promise<Uint8Array> => {
  const key = fileKey(pluginId, path)
  const stored = await withStore<ArrayBuffer | Uint8Array>('readonly', store => store.get(key))
  if (stored) return stored instanceof Uint8Array ? stored : new Uint8Array(stored)
  const memory = memoryFiles.get(key)
  if (memory) return memory
  throw new Error(`plugin file not found: ${pluginId}/${path}`)
}

const getTauriPluginPath = async (pluginId: string, path: string) => {
  const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
  return await join(await appLocalDataDir(), 'plugin', pluginId, path)
}

export const readPluginFile = async (pluginId: string, path: string): Promise<Uint8Array> => {
  if (!isTauriRuntime()) return await readWebFile(pluginId, path)
  const fs = await import('@tauri-apps/plugin-fs')
  return await fs.readFile(await getTauriPluginPath(pluginId, path))
}

export const readPluginText = async (pluginId: string, path: string) =>
  new TextDecoder().decode(await readPluginFile(pluginId, path))

const mimeTypeFor = (path: string) => {
  const extension = path.split('.').at(-1)?.toLowerCase()
  return (
    {
      avif: 'image/avif',
      gif: 'image/gif',
      jpeg: 'image/jpeg',
      jpg: 'image/jpeg',
      png: 'image/png',
      svg: 'image/svg+xml',
      webp: 'image/webp',
      woff: 'font/woff',
      woff2: 'font/woff2',
    }[extension ?? ''] ?? 'application/octet-stream'
  )
}

export const listPluginFiles = async (pluginId: string): Promise<string[]> => {
  if (isTauriRuntime()) {
    const fs = await import('@tauri-apps/plugin-fs')
    const entries = await fs.readDir(await getTauriPluginPath(pluginId, ''))
    return entries.filter(entry => entry.isFile).map(entry => entry.name)
  }
  const prefix = `${pluginId}/`
  const keys = new Set(
    [...memoryFiles.keys()]
      .filter(key => key.startsWith(prefix))
      .map(key => key.slice(prefix.length)),
  )
  const storedKeys = await withStore<IDBValidKey[]>('readonly', store => store.getAllKeys())
  for (const key of storedKeys ?? []) {
    const value = String(key)
    if (value.startsWith(prefix)) keys.add(value.slice(prefix.length))
  }
  return [...keys]
}

export const createPluginModuleUrl = async (pluginId: string, path: string) => {
  if (isTauriRuntime()) {
    const { convertFileSrc } = await import('@tauri-apps/api/core')
    return convertFileSrc(await getTauriPluginPath(pluginId, path))
  }
  const bytes = await readPluginFile(pluginId, path)
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  return URL.createObjectURL(new Blob([buffer], { type: 'text/javascript' }))
}

export const createPluginAssetUrl = async (pluginId: string, path: string) => {
  if (isTauriRuntime()) {
    const { convertFileSrc } = await import('@tauri-apps/api/core')
    return convertFileSrc(await getTauriPluginPath(pluginId, path))
  }
  const bytes = await readPluginFile(pluginId, path)
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  const url = URL.createObjectURL(new Blob([buffer], { type: mimeTypeFor(path) }))
  const urls = pluginObjectUrls.get(pluginId) ?? new Set<string>()
  urls.add(url)
  pluginObjectUrls.set(pluginId, urls)
  return url
}

export const releasePluginObjectUrls = (pluginId: string) => {
  const urls = pluginObjectUrls.get(pluginId)
  if (!urls) return
  for (const url of urls) URL.revokeObjectURL(url)
  pluginObjectUrls.delete(pluginId)
}

export const removePluginFiles = async (pluginId: string) => {
  releasePluginObjectUrls(pluginId)
  if (!isTauriRuntime()) {
    await replaceWebPlugin(pluginId, new Map())
    return
  }
  const fs = await import('@tauri-apps/plugin-fs')
  const root = await getTauriPluginPath(pluginId, '')
  if (await fs.exists(root)) await fs.remove(root, { recursive: true })
}

export const decodeDevMetaFromCode = (code: string): PluginArchiveDB.Meta => {
  const marker = '@description'
  const markerIndex = code.indexOf(marker)
  if (markerIndex < 0) throw new Error('not found @description metadata')
  const rest = code.slice(markerIndex + marker.length).trimStart()
  const [json] = rest.split(/\r?\n/, 1)
  return JSON.parse(json.trim()) as PluginArchiveDB.Meta
}

const assertPluginId = (meta: PluginArchiveDB.Meta) => {
  const id = meta.name?.id
  if (!id || id === '.' || id === '..' || /[\\/]/.test(id)) {
    throw new Error(`invalid plugin id: ${id}`)
  }
  return id
}

const hex = (bytes: Uint8Array) =>
  [...bytes].map(value => value.toString(16).padStart(2, '0')).join('')

export const digestPluginBytes = async (
  bytes: Uint8Array,
): Promise<NonNullable<PluginArchiveDB.Meta['integrity']>> => {
  try {
    const [{ default: loadBlake3 }, { default: wasmUrl }] = await Promise.all([
      import('blake3-wasm/browser-async'),
      import('blake3-wasm/dist/wasm/web/blake3_js_bg.wasm?url'),
    ])
    const { hash } = await loadBlake3(wasmUrl)
    return { algorithm: 'blake3', digest: hash(bytes).toString('hex') }
  } catch (error) {
    console.warn('[plugin storage] Rust BLAKE3 WASM unavailable, using Web Crypto', error)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)
    return { algorithm: 'sha256', digest: hex(new Uint8Array(digest)) }
  }
}

const withIntegrity = async (meta: PluginArchiveDB.Meta, bytes: Uint8Array) => ({
  ...meta,
  integrity: await digestPluginBytes(bytes),
})

export const installDevCode = async (code: string): Promise<PluginArchiveDB.Meta> => {
  const bytes = new TextEncoder().encode(code)
  const meta = await withIntegrity(decodeDevMetaFromCode(code), bytes)
  if (isTauriRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core')
    const nativeMeta = await invoke<PluginArchiveDB.Meta>('plugin:plugin|install_dev', { code })
    return { ...nativeMeta, integrity: meta.integrity }
  }
  const pluginId = assertPluginId(meta)
  await replaceWebPlugin(pluginId, new Map([['us.js', bytes]]))
  return meta
}

export const installZipFile = async (
  file: File,
  onProgress?: (progress: NativeInstallProgress) => void,
): Promise<PluginArchiveDB.Meta> => {
  const archiveBytes = new Uint8Array(await file.arrayBuffer())
  if (isTauriRuntime()) {
    const { createNativeOperationId, installZip, writeNativeTempFile } = await import('./native')
    const nativeMeta = await installZip(
      await writeNativeTempFile(file),
      createNativeOperationId(),
      onProgress,
    )
    return await withIntegrity(nativeMeta, archiveBytes)
  }

  const zip = await JSZip.loadAsync(archiveBytes)
  const manifest = zip.file('manifest.json')
  if (!manifest) throw new Error('plugin archive does not contain manifest.json')
  const meta = await withIntegrity(
    JSON.parse(await manifest.async('text')) as PluginArchiveDB.Meta,
    archiveBytes,
  )
  const pluginId = assertPluginId(meta)
  const entries = Object.values(zip.files).filter(entry => !entry.dir)
  const stagedFiles = new Map<string, Uint8Array>()
  onProgress?.({ current: 0, opId: '', phase: 'start', total: entries.length })
  for (const [index, entry] of entries.entries()) {
    const normalized = entry.name.replaceAll('\\', '/')
    if (normalized.startsWith('/') || normalized.split('/').includes('..')) continue
    stagedFiles.set(normalized, await entry.async('uint8array'))
    onProgress?.({
      current: index + 1,
      opId: '',
      path: normalized,
      phase: 'extract',
      total: entries.length,
    })
  }
  await replaceWebPlugin(pluginId, stagedFiles)
  onProgress?.({ current: entries.length, opId: '', phase: 'done', total: entries.length })
  return meta
}