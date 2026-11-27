import type { PluginArchiveDB } from '@delta-comic/platform/db'
import type { Component, Context } from 'cordis'

import { validateArtifact } from './artifact'
import type { LoadedPluginModule, PluginFileStore, PluginModuleReader } from './contracts'
import { DEV_CSS_PATH, DEV_SESSION_QUERY, devServerUrl, parseDevServerPort } from './dev'
import { safePluginPath } from './manifest'
import { createArtifactModuleGraph } from './moduleGraph'

export const parseClientPluginEntry = (
  value: unknown,
  plugin: string,
): readonly Component.Function[] => {
  const isFunctionArray = (value: unknown): value is readonly Component.Function[] =>
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
  public constructor(private readonly files: PluginFileStore) {}

  public async read(
    archive: PluginArchiveDB.Archive,
    signal: AbortSignal,
  ): Promise<LoadedPluginModule> {
    const manifest = archive.meta

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
  public async read(
    archive: PluginArchiveDB.Archive,
    signal: AbortSignal,
  ): Promise<LoadedPluginModule> {
    const port = parseDevServerPort(archive.installInput)
    if (port === undefined)
      throw new Error(`invalid development install source: ${archive.installInput}`)
    const entryModulePath = archive.meta.entryModulePath
    const session = crypto.randomUUID()
    const url = new URL(devServerUrl(port, safePluginPath(entryModulePath, 'entry module path')))
    url.searchParams.set(DEV_SESSION_QUERY, session)
    url.searchParams.set('t', Date.now().toString())
    const module: unknown = await import(/* @vite-ignore */ url.href)
    signal.throwIfAborted()
    const functions = moduleEntry(module, archive.pluginName)
    const response = await fetch(devServerUrl(port, DEV_CSS_PATH), {
      cache: 'no-store',
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    })
    if (!response.ok && response.status !== 404)
      throw new Error(`development CSS request failed: ${response.status}`)
    const styleText = response.status === 404 ? '' : await response.text()
    signal.throwIfAborted()
    return {
      functions,
      dev: { session },
      activate(ctx) {
        if (typeof document === 'undefined' || !styleText) return
        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.plugin = archive.pluginName
          style.textContent = styleText
          document.head.append(style)
          return () => style.remove()
        }, 'plugin CSS')
      },
    }
  }
}