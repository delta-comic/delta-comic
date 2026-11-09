import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { GlobalConfig, PluginSpec } from 'semantic-release'

export interface CIConfig {
  jsonVersionPaths?: readonly string[]
  cargoTomlVersionPaths?: readonly (readonly [string, 'package' | 'workspace.package'])[]
  cargoLockPackageNames?: readonly string[]
  msiConfigPath?: string
  workspace?: { roots?: readonly string[] }
  buildCommand?: { command: string; args?: readonly string[] }
  publishCommand?: { command: string; args?: readonly string[] }
  registry?: string
}

export const releasePluginName = '@delta-comic/release-cli'

type ReleaseConfig = GlobalConfig & { withCI(config: CIConfig): GlobalConfig }

function pluginName(plugin: PluginSpec) {
  return Array.isArray(plugin) ? plugin[0] : plugin
}

export function defineConfig(config: GlobalConfig): ReleaseConfig {
  const plugins = config.plugins.filter(plugin => pluginName(plugin) !== releasePluginName)
  const createConfig = (ci?: CIConfig): GlobalConfig => {
    const releasePlugin = ci === undefined ? releasePluginName : [releasePluginName, ci]
    return {
      ...config,
      plugins: [plugins[0], releasePlugin, ...plugins.slice(1)].filter(
        (plugin): plugin is PluginSpec => plugin !== undefined,
      ),
    }
  }

  return { ...createConfig(), withCI: createConfig }
}

export async function loadCIConfig(cwd: string, configPath?: string) {
  const path = configPath ? resolve(cwd, configPath) : join(cwd, 'release.config.ts')
  if (!existsSync(path)) return {}
  const module = await import(pathToFileURL(path).href)
  const config = module.default
  if (!config || typeof config !== 'object') {
    throw new Error(`semantic-release config must default-export an object: ${path}`)
  }

  const plugin = (config as GlobalConfig).plugins.find(
    plugin => pluginName(plugin) === releasePluginName,
  )
  if (!plugin) throw new Error(`semantic-release config must include ${releasePluginName}: ${path}`)
  return Array.isArray(plugin) ? plugin[1] : {}
}

export function findProjectRoot(input: string) {
  let directory = resolve(input)
  let packageRoot: string | undefined
  while (true) {
    if (existsSync(join(directory, '.git'))) return directory
    if (!packageRoot && existsSync(join(directory, 'package.json'))) packageRoot = directory
    const parent = dirname(directory)
    if (parent === directory) {
      if (packageRoot) return packageRoot
      throw new Error(`Unable to find a project root from ${input}`)
    }
    directory = parent
  }
}