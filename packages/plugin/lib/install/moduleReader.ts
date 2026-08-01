import type { PluginConfigFactory, PluginManifest } from '../api'
import type { LoadedPluginModule } from '../kernel'

import type { PluginFileStore, PluginModuleReader } from './contracts'

const asFactory = (value: unknown, plugin: string): PluginConfigFactory => {
  if (typeof value !== 'function') {
    throw new TypeError(`plugin entry has no default factory: ${plugin}`)
  }
  return value as PluginConfigFactory
}

export class StoredPluginModuleReader implements PluginModuleReader {
  public constructor(private readonly files: PluginFileStore) {}

  public async read(
    plugin: string,
    manifest: PluginManifest,
    signal: AbortSignal,
  ): Promise<LoadedPluginModule> {
    const entry = manifest.entry?.jsPath ?? 'index.mjs'
    const url = await this.files.createModuleUrl(plugin, entry)
    if (signal.aborted) {
      this.files.release(plugin)
      throw signal.reason
    }
    const module = (await import(/* @vite-ignore */ url)) as { default?: unknown }
    let style: HTMLStyleElement | undefined
    if (manifest.entry?.cssPath && typeof document !== 'undefined') {
      style = document.createElement('style')
      style.dataset.plugin = plugin
      style.textContent = new TextDecoder().decode(
        await this.files.read(plugin, manifest.entry.cssPath),
      )
      document.head.append(style)
    }
    return {
      factory: asFactory(module.default, plugin),
      dispose: () => {
        style?.remove()
        this.files.release(plugin)
      },
    }
  }
}