import { isTauri } from '@tauri-apps/api/core'

import type { PluginFileReplacement, PluginFileStore } from '../install'
import { safePluginPath } from '../install'

type PluginFiles = ReadonlyMap<string, Uint8Array>

interface PluginFileBackend {
  read(plugin: string, path: string): Promise<Uint8Array>
  snapshot(plugin: string): Promise<Map<string, Uint8Array>>
  replace(plugin: string, files: PluginFiles): Promise<void>
  moduleUrl?(plugin: string, path: string): Promise<string>
}

const cloneFiles = (files: PluginFiles) =>
  new Map([...files].map(([path, bytes]) => [path, Uint8Array.from(bytes)]))

export class MemoryPluginFileStore implements PluginFileStore {
  readonly #files = new Map<string, Map<string, Uint8Array>>()
  readonly #urls = new Map<string, Set<string>>()

  public async replace(plugin: string, files: PluginFiles): Promise<PluginFileReplacement> {
    const previous = cloneFiles(this.#files.get(plugin) ?? new Map())
    this.#files.set(plugin, cloneFiles(files))
    let settled = false
    return {
      commit: async () => {
        settled = true
      },
      rollback: async () => {
        if (settled) return
        settled = true
        this.#files.set(plugin, previous)
      },
    }
  }

  public async remove(plugin: string) {
    this.release(plugin)
    this.#files.delete(plugin)
  }

  public async read(plugin: string, path: string) {
    const bytes = this.#files.get(plugin)?.get(safePluginPath(path, 'plugin file path'))
    if (!bytes) throw new Error(`plugin file not found: ${plugin}/${path}`)
    return Uint8Array.from(bytes)
  }

  public async createModuleUrl(plugin: string, path: string) {
    const bytes = await this.read(plugin, path)
    const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: 'text/javascript' }))
    const urls = this.#urls.get(plugin) ?? new Set<string>()
    urls.add(url)
    this.#urls.set(plugin, urls)
    return url
  }

  public release(plugin: string) {
    for (const url of this.#urls.get(plugin) ?? []) URL.revokeObjectURL(url)
    this.#urls.delete(plugin)
  }
}

class IndexedDbPluginFileBackend implements PluginFileBackend {
  readonly #database = 'delta-comic-plugin-files-v2'
  readonly #store = 'files'

  async #open() {
    return await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.#database, 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(this.#store)) {
          request.result.createObjectStore(this.#store)
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  #key(plugin: string, path: string) {
    return `${plugin}/${path}`
  }

  public async read(plugin: string, path: string) {
    const database = await this.#open()
    try {
      return await new Promise<Uint8Array>((resolve, reject) => {
        const transaction = database.transaction(this.#store, 'readonly')
        const request = transaction.objectStore(this.#store).get(this.#key(plugin, path))
        request.onsuccess = () => {
          if (!request.result) reject(new Error(`plugin file not found: ${plugin}/${path}`))
          else resolve(Uint8Array.from(request.result as Uint8Array))
        }
        request.onerror = () => reject(request.error)
      })
    } finally {
      database.close()
    }
  }

  public async snapshot(plugin: string) {
    const database = await this.#open()
    try {
      return await new Promise<Map<string, Uint8Array>>((resolve, reject) => {
        const files = new Map<string, Uint8Array>()
        const transaction = database.transaction(this.#store, 'readonly')
        const request = transaction.objectStore(this.#store).openCursor()
        const prefix = `${plugin}/`
        request.onsuccess = () => {
          const cursor = request.result
          if (!cursor) return
          const key = String(cursor.key)
          if (key.startsWith(prefix))
            files.set(key.slice(prefix.length), Uint8Array.from(cursor.value))
          cursor.continue()
        }
        request.onerror = () => reject(request.error)
        transaction.oncomplete = () => resolve(files)
        transaction.onerror = () => reject(transaction.error)
      })
    } finally {
      database.close()
    }
  }

  public async replace(plugin: string, files: PluginFiles) {
    const database = await this.#open()
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(this.#store, 'readwrite')
        const store = transaction.objectStore(this.#store)
        const prefix = `${plugin}/`
        const cursor = store.openKeyCursor()
        cursor.onsuccess = () => {
          if (cursor.result) {
            if (String(cursor.result.key).startsWith(prefix)) cursor.result.delete()
            cursor.result.continue()
            return
          }
          for (const [path, bytes] of files) store.put(bytes, this.#key(plugin, path))
        }
        cursor.onerror = () => reject(cursor.error)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      })
    } finally {
      database.close()
    }
  }
}

class TauriPluginFileBackend implements PluginFileBackend {
  async #root(plugin: string) {
    const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
    return await join(await appLocalDataDir(), 'plugin', plugin)
  }

  public async read(plugin: string, path: string) {
    const [{ join }, fs] = await Promise.all([
      import('@tauri-apps/api/path'),
      import('@tauri-apps/plugin-fs'),
    ])
    return await fs.readFile(await join(await this.#root(plugin), path))
  }

  public async snapshot(plugin: string) {
    const [{ join }, fs] = await Promise.all([
      import('@tauri-apps/api/path'),
      import('@tauri-apps/plugin-fs'),
    ])
    const root = await this.#root(plugin)
    const files = new Map<string, Uint8Array>()
    if (!(await fs.exists(root))) return files
    const visit = async (directory: string, prefix = '') => {
      for (const entry of await fs.readDir(directory)) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name
        const absolute = await join(directory, entry.name)
        if (entry.isDirectory) await visit(absolute, path)
        else if (entry.isFile) files.set(path, await fs.readFile(absolute))
      }
    }
    await visit(root)
    return files
  }

  public async replace(plugin: string, files: PluginFiles) {
    const [{ appLocalDataDir, join }, fs] = await Promise.all([
      import('@tauri-apps/api/path'),
      import('@tauri-apps/plugin-fs'),
    ])
    const base = await join(await appLocalDataDir(), 'plugin')
    const token = crypto.randomUUID()
    const live = await join(base, plugin)
    const staging = await join(base, '__staging__', `${plugin}-${token}`)
    const backup = await join(base, '__backup__', `${plugin}-${token}`)
    await fs.mkdir(staging, { recursive: true })
    try {
      for (const [path, bytes] of files) {
        const segments = safePluginPath(path, 'plugin file path').split('/')
        const target = await join(staging, ...segments)
        const parent = await join(staging, ...segments.slice(0, -1))
        await fs.mkdir(parent, { recursive: true })
        await fs.writeFile(target, bytes)
      }
      const existed = await fs.exists(live)
      if (existed) {
        await fs.mkdir(await join(base, '__backup__'), { recursive: true })
        await fs.rename(live, backup)
      }
      try {
        await fs.rename(staging, live)
      } catch (error) {
        if (existed && (await fs.exists(backup))) await fs.rename(backup, live)
        throw error
      }
      if (await fs.exists(backup)) await fs.remove(backup, { recursive: true })
    } catch (error) {
      if (await fs.exists(staging)) await fs.remove(staging, { recursive: true })
      throw error
    }
  }

  public async moduleUrl(plugin: string, path: string) {
    const { convertFileSrc } = await import('@tauri-apps/api/core')
    const { join } = await import('@tauri-apps/api/path')
    return convertFileSrc(await join(await this.#root(plugin), path))
  }
}

export class AtomicPluginFileStore implements PluginFileStore {
  readonly #urls = new Map<string, Set<string>>()

  public constructor(private readonly backend: PluginFileBackend) {}

  public async replace(plugin: string, files: PluginFiles) {
    const previous = await this.backend.snapshot(plugin)
    await this.backend.replace(plugin, files)
    let settled = false
    return {
      commit: async () => {
        settled = true
      },
      rollback: async () => {
        if (settled) return
        settled = true
        await this.backend.replace(plugin, previous)
      },
    }
  }

  public async remove(plugin: string) {
    this.release(plugin)
    await this.backend.replace(plugin, new Map())
  }

  public read(plugin: string, path: string) {
    return this.backend.read(plugin, safePluginPath(path, 'plugin file path'))
  }

  public async createModuleUrl(plugin: string, path: string) {
    const safePath = safePluginPath(path, 'plugin module path')
    if (this.backend.moduleUrl) return await this.backend.moduleUrl(plugin, safePath)
    const bytes = await this.backend.read(plugin, safePath)
    const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: 'text/javascript' }))
    const urls = this.#urls.get(plugin) ?? new Set<string>()
    urls.add(url)
    this.#urls.set(plugin, urls)
    return url
  }

  public release(plugin: string) {
    for (const url of this.#urls.get(plugin) ?? []) URL.revokeObjectURL(url)
    this.#urls.delete(plugin)
  }
}

export const createDefaultPluginFileStore = () =>
  new AtomicPluginFileStore(
    isTauri() ? new TauriPluginFileBackend() : new IndexedDbPluginFileBackend(),
  )