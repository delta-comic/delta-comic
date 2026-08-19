import type { PluginArchiveDB } from '@delta-comic/db'

import type { PluginConfigFactory } from '../api'
import type { LoadedPluginModule } from '../kernel'

import type { PluginFileStore, PluginModuleReader } from './contracts'
import {
  DEV_CSS_PATH,
  DEV_ENTRY_PATH,
  DEV_SERVER_LOADER_ID,
  devServerUrl,
  parseDevServerPort,
} from './dev'

const asFactory = (value: unknown, plugin: string): PluginConfigFactory => {
  if (typeof value !== 'function') {
    throw new TypeError(`plugin entry has no default factory: ${plugin}`)
  }
  return value as PluginConfigFactory
}

const styleActivator = (plugin: string, styleText: string | undefined) =>
  styleText === undefined
    ? undefined
    : (scope: import('../kernel').PluginScope) => {
        if (typeof document === 'undefined') return
        const style = document.createElement('style')
        style.dataset.plugin = plugin
        style.textContent = styleText
        document.head.append(style)
        scope.defer(() => style.remove())
      }

export class StoredPluginModuleReader implements PluginModuleReader {
  public readonly id = 'stored'

  public constructor(private readonly files: PluginFileStore) {}

  public async read(
    archive: PluginArchiveDB.Archive,
    signal: AbortSignal,
  ): Promise<LoadedPluginModule> {
    const plugin = archive.pluginName
    const url = await this.files.createModuleUrl(plugin, 'index.mjs')
    if (signal.aborted) {
      this.files.release(plugin)
      throw signal.reason
    }
    try {
      const module = (await import(/* @vite-ignore */ url)) as { default?: unknown }
      signal.throwIfAborted()
      let styleText: string | undefined
      try {
        styleText = new TextDecoder().decode(await this.files.read(plugin, 'index.css'))
      } catch {
        styleText = undefined
      }
      signal.throwIfAborted()
      return {
        activate: styleActivator(plugin, styleText),
        factory: asFactory(module.default, plugin),
        dispose: () => this.files.release(plugin),
      }
    } catch (error) {
      this.files.release(plugin)
      throw error
    }
  }
}

export class DevServerPluginModuleReader implements PluginModuleReader {
  public readonly id = DEV_SERVER_LOADER_ID
  readonly #versions = new Map<string, number>()

  public matches(archive: PluginArchiveDB.Archive) {
    return archive.loaderName === this.id
  }

  public async read(
    archive: PluginArchiveDB.Archive,
    signal: AbortSignal,
  ): Promise<LoadedPluginModule> {
    const port = parseDevServerPort(archive.installInput)
    if (port === undefined) {
      throw new Error(`development plugin has an invalid install source: ${archive.installInput}`)
    }
    const previousVersion = this.#versions.get(archive.pluginName)
    const version = (previousVersion ?? 0) + 1
    this.#versions.set(archive.pluginName, version)
    signal.throwIfAborted()

    // Keep the first entry URL stable so its source modules share one native Vite HMR graph.
    // Explicit plugin updates still get a fresh bootstrap URL after the first load.
    const entryUrl = devServerUrl(port, DEV_ENTRY_PATH)
    const module = (await import(
      /* @vite-ignore */ previousVersion === undefined ? entryUrl : `${entryUrl}?v=${version}`
    )) as { default?: unknown }
    signal.throwIfAborted()

    let styleText: string | undefined
    const response = await fetch(devServerUrl(port, DEV_CSS_PATH), { cache: 'no-store', signal })
    if (response.status !== 404) {
      if (!response.ok) throw new Error(`development plugin CSS request failed: ${response.status}`)
      styleText = await response.text()
    }
    signal.throwIfAborted()
    return {
      activate: styleActivator(archive.pluginName, styleText),
      factory: asFactory(module.default, archive.pluginName),
    }
  }
}