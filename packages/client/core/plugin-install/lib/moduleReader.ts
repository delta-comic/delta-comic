import type { PluginArchiveDB } from '@delta-comic/db'
import { validateArtifact } from '@delta-comic/plugin-artifact'
import type { Context, Plugin } from 'cordis'

import type { LoadedPluginModule, PluginFileStore, PluginModuleReader } from './contracts'
import { DEV_CSS_PATH, DEV_SERVER_LOADER_ID, devServerUrl, parseDevServerPort } from './dev'
import { safePluginPath } from './manifest'
import { createArtifactModuleGraph } from './moduleGraph'

export const parseClientPluginEntry = (
  value: unknown,
  plugin: string,
): readonly Plugin.Function[] => {
  const isFunctionArray = (value: unknown): value is readonly Plugin.Function[] =>
    Array.isArray(value) && value.every(item => typeof item === 'function')
  if (!isFunctionArray(value))
    throw new TypeError(`client entry must export a function array: ${plugin}`)
  return value
}

const moduleEntry = (module: unknown, plugin: string) =>
  parseClientPluginEntry(
    typeof module === 'object' && module !== null && 'default' in module
      ? module.default
      : undefined,
    plugin,
  )

const styleActivator = (plugin: string, text: string) => (ctx: Context) => {
  if (typeof document === 'undefined' || !text) return
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = plugin
    style.textContent = text
    document.head.append(style)
    return () => style.remove()
  }, 'plugin CSS')
}

export class StoredPluginModuleReader implements PluginModuleReader {
  public readonly id = 'stored'

  public constructor(private readonly files: PluginFileStore) {}

  public async read(
    archive: PluginArchiveDB.Archive,
    signal: AbortSignal,
  ): Promise<LoadedPluginModule> {
    const manifest = archive.meta
    if (!manifest.client) throw new Error(`plugin has no client entry: ${archive.pluginName}`)
    const resources = new Map<string, Uint8Array>()
    for (const resource of manifest.resources) {
      resources.set(resource.path, await this.files.read(archive.pluginName, resource.path))
      signal.throwIfAborted()
    }
    await validateArtifact({
      manifest,
      files: [...resources].map(([path, bytes]) => ({ path, bytes })),
    })
    const graph = await createArtifactModuleGraph(manifest, resources)
    try {
      const module: unknown = await import(/* @vite-ignore */ graph.url)
      signal.throwIfAborted()
      const styleText = manifest.resources
        .filter(resource => resource.mimeType === 'text/css')
        .map(resource => new TextDecoder().decode(resources.get(resource.path)))
        .join('\n')
      return {
        functions: moduleEntry(module, archive.pluginName),
        activate: styleActivator(archive.pluginName, styleText),
        dispose: () => {
          graph.dispose()
          this.files.release(archive.pluginName)
        },
      }
    } catch (error) {
      graph.dispose()
      this.files.release(archive.pluginName)
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
    if (port === undefined)
      throw new Error(`invalid development install source: ${archive.installInput}`)
    const entry = archive.meta.client?.entry
    if (!entry) throw new Error(`plugin has no client entry: ${archive.pluginName}`)
    const previous = this.#versions.get(archive.pluginName)
    const version = (previous ?? 0) + 1
    this.#versions.set(archive.pluginName, version)
    const url = devServerUrl(port, safePluginPath(entry, 'client entry'))
    const module: unknown = await import(
      /* @vite-ignore */ `${url}${previous === undefined ? '' : `?v=${version}`}`
    )
    signal.throwIfAborted()
    const response = await fetch(devServerUrl(port, DEV_CSS_PATH), { cache: 'no-store', signal })
    if (!response.ok && response.status !== 404)
      throw new Error(`development CSS request failed: ${response.status}`)
    const text = response.status === 404 ? '' : await response.text()
    signal.throwIfAborted()
    return {
      functions: moduleEntry(module, archive.pluginName),
      activate: styleActivator(archive.pluginName, text),
    }
  }
}