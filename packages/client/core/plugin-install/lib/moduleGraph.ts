import type { PluginManifest } from '@delta-comic/plugin-manifest'
import { init, parse } from 'es-module-lexer'

import { safePluginPath } from './manifest'

export interface ModuleGraphUrl {
  readonly url: string
  dispose(): void
}

export const createArtifactModuleGraph = async (
  manifest: PluginManifest,
  files: ReadonlyMap<string, Uint8Array>,
): Promise<ModuleGraphUrl> => {
  await init
  if (!manifest.client) throw new Error(`plugin has no client entry: ${manifest.id}`)
  const urls = new Map<string, string>()
  const visiting = new Set<string>()
  const resources = new Map(manifest.resources.map(resource => [resource.path, resource]))
  const dispose = () => {
    for (const url of urls.values()) URL.revokeObjectURL(url)
  }
  const build = (path: string): string => {
    const cached = urls.get(path)
    if (cached) return cached
    if (visiting.has(path)) throw new Error(`cyclic artifact import: ${path}`)
    const bytes = files.get(path)
    const resource = resources.get(path)
    if (!bytes || !resource) throw new Error(`module resource is missing: ${path}`)
    visiting.add(path)
    let source = new TextDecoder().decode(bytes)
    const [imports] = parse(source)
    for (const imported of [...imports].reverse()) {
      if (imported.d === -2) continue
      if (!imported.n) throw new Error(`module import requires a literal path: ${path}`)
      if (!imported.n.startsWith('./') && !imported.n.startsWith('../')) {
        throw new Error(`module import must be packaged: ${imported.n}`)
      }
      const resolved = new URL(imported.n, `https://artifact.local/${path}`)
      const target = safePluginPath(decodeURIComponent(resolved.pathname.slice(1)), 'module import')
      if (!resource.imports.includes(target)) throw new Error(`undeclared module import: ${target}`)
      const url = build(target)
      const replacement = imported.d >= 0 ? JSON.stringify(url) : url
      source = source.slice(0, imported.s) + replacement + source.slice(imported.e)
    }
    const url = URL.createObjectURL(new Blob([source], { type: resource.mimeType }))
    urls.set(path, url)
    visiting.delete(path)
    return url
  }
  try {
    return { url: build(safePluginPath(manifest.client.entry, 'client entry')), dispose }
  } catch (error) {
    dispose()
    throw error
  }
}