import type { PluginManifest, PluginResource } from '@delta-comic/plugin-manifest'

import { safePluginPath } from './manifest'

export interface ModuleGraphUrl {
  readonly url: string
  dispose(): void
}

const javascriptMime = (resource: PluginResource) =>
  resource.mimeType.includes('javascript') || resource.path.endsWith('.mjs')

const relativePath = (from: string, specifier: string) => {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return undefined
  const [path, suffix = ''] = specifier.split(/([?#].*)/, 2)
  const base = from.split('/')
  base.pop()
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') base.pop()
    else base.push(segment)
  }
  return `${safePluginPath(base.join('/'), 'module import')}${suffix}`
}

const rewriteImports = (source: string, from: string, urls: ReadonlyMap<string, string>) => {
  const pattern = /(\b(?:import|export)\s*(?:\(\s*)?(?:[^'"`]*?\sfrom\s*)?)(['"])([^'"`]+)\2/g
  return source.replace(pattern, (full, prefix: string, quote: string, specifier: string) => {
    const path = relativePath(from, specifier)
    const target = path ? urls.get(path) : undefined
    return target ? `${prefix}${quote}${target}${quote}` : full
  })
}

/**
 * Creates a self-contained module URL graph for artifacts loaded from Blob URLs.
 * Relative static and dynamic imports are rewritten to the generated resource URLs.
 */
export const createArtifactModuleGraph = async (
  manifest: PluginManifest,
  files: ReadonlyMap<string, Uint8Array>,
): Promise<ModuleGraphUrl> => {
  const resources = manifest.resources.filter(javascriptMime)
  const rawUrls = new Map<string, string>()
  const temporaryUrls: string[] = []
  for (const resource of resources) {
    const path = safePluginPath(resource.path, 'module resource path')
    if (!files.has(path)) throw new Error(`module resource is missing: ${path}`)
  }
  for (const resource of resources) {
    const path = safePluginPath(resource.path, 'module resource path')
    const bytes = files.get(path)
    if (!bytes) throw new Error(`module resource is missing: ${path}`)
    const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: resource.mimeType }))
    rawUrls.set(path, url)
    temporaryUrls.push(url)
  }

  const finalUrls = new Map<string, string>()
  for (const resource of resources) {
    const path = safePluginPath(resource.path, 'module resource path')
    const bytes = files.get(path)
    if (!bytes) throw new Error(`module resource is missing: ${path}`)
    const source = new TextDecoder().decode(bytes)
    const transformed = rewriteImports(source, path, rawUrls)
    const url = URL.createObjectURL(new Blob([transformed], { type: resource.mimeType }))
    finalUrls.set(path, url)
  }
  const entry = safePluginPath(manifest.entry, 'manifest.entry')
  const url = finalUrls.get(entry)
  if (!url) {
    temporaryUrls.forEach(value => URL.revokeObjectURL(value))
    finalUrls.forEach(value => URL.revokeObjectURL(value))
    throw new Error(`module entry is not a JavaScript resource: ${entry}`)
  }
  return {
    url,
    dispose: () => {
      for (const value of temporaryUrls) URL.revokeObjectURL(value)
      for (const value of finalUrls.values()) URL.revokeObjectURL(value)
    },
  }
}
