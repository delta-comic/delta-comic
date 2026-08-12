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
    try {
      const module = (await import(/* @vite-ignore */ url)) as { default?: unknown }
      signal.throwIfAborted()
      const styleText = manifest.entry?.cssPath
        ? new TextDecoder().decode(await this.files.read(plugin, manifest.entry.cssPath))
        : undefined
      signal.throwIfAborted()
      return {
        activate:
          styleText === undefined
            ? undefined
            : scope => {
                if (typeof document === 'undefined') return
                const style = document.createElement('style')
                style.dataset.plugin = plugin
                style.textContent = styleText
                document.head.append(style)
                scope.defer(() => style.remove())
              },
        factory: asFactory(module.default, plugin),
        dispose: () => this.files.release(plugin),
      }
    } catch (error) {
      this.files.release(plugin)
      throw error
    }
  }
}