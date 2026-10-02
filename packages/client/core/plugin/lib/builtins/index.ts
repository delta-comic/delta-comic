import type { PluginManifest } from '@delta-comic/plugin-manifest'
import type { Plugin } from 'cordis'

export { manifest as coreManifest } from './core.builtin'

const modules = import.meta.glob<{ default: readonly Plugin.Function[]; manifest: PluginManifest }>(
  './*.builtin.ts',
  { eager: true },
)

export const builtinPlugins = Object.entries(modules)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([path, module]) => {
    if (!Array.isArray(module.default) || module.default.some(fn => typeof fn !== 'function')) {
      throw new Error(`built-in entry must export a function array: ${path}`)
    }
    return { manifest: module.manifest, functions: module.default }
  })