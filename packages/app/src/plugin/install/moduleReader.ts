import type { PluginArchiveDB } from '@delta-comic/platform/db'
import type { ModuleRegistry } from '@delta-comic/runtime'
import type { Component, Context } from 'cordis'

import { registerScript } from '../registration'

import type { PluginFileStore, LoadedPluginModule } from './contracts'
import { readRevision } from './revision'

export function parseClientPluginEntry(value: unknown, id: string): readonly Component.Function[] {
  if (!Array.isArray(value) || !value.every(fn => typeof fn === 'function'))
    throw new TypeError(`invalid components: ${id}`)
  return value
}

export class StoredPluginModuleReader {
  constructor(private readonly files: PluginFileStore) {}
  async prepare(archive: PluginArchiveDB.Archive) {
    const id = archive.pluginName
    if (!archive.revision) throw new Error(`${id}: 使用新版 SDK 重新构建`)
    const { manifest, resources } = await readRevision(this.files, id, archive.revision)
    if (JSON.stringify(manifest) !== JSON.stringify(archive.meta))
      throw new Error(`${id}: installation metadata mismatch`)
    const factory = await registerScript(manifest.package, resources.get(manifest.script)!)
    const css = manifest.resources
      .filter(r => r.mimeType === 'text/css')
      .map(r => new TextDecoder().decode(resources.get(r.path)))
      .join('\n')
    return {
      entry: { ...manifest, factory },
      load(registry: ModuleRegistry): LoadedPluginModule {
        return {
          functions: parseClientPluginEntry(registry.evaluate(manifest.package).components, id),
          activate(ctx: Context) {
            if (!css) return
            ctx.effect(() => {
              const style = document.createElement('style')
              style.dataset.plugin = id
              style.textContent = css
              document.head.append(style)
              return () => style.remove()
            }, 'plugin CSS')
          },
        }
      },
    }
  }
}