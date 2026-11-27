import semver from 'semver'

import { parseModuleManifest, type ModuleManifest } from './modules'
export * from './modules'
export type PluginManifest = ModuleManifest
export type PluginUserConfig = Record<string, unknown>
export const parsePluginManifest = parseModuleManifest
export function isPluginManifest(value: unknown): value is PluginManifest {
  try {
    parsePluginManifest(value)
    return true
  } catch {
    return false
  }
}
export function assertPluginManifestCompatible(
  manifest: Pick<PluginManifest, 'supportCoreVersion'>,
  version: string,
) {
  if (!semver.satisfies(version, manifest.supportCoreVersion, { includePrerelease: true }))
    throw new Error(`plugin core range ${manifest.supportCoreVersion} does not support ${version}`)
}