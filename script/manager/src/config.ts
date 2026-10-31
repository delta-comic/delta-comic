import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export interface ReleaseCliConfig {
  jsonVersionPaths?: readonly string[]
  cargoTomlVersionPaths?: readonly (readonly [string, 'package' | 'workspace.package'])[]
  cargoLockPackageNames?: readonly string[]
  msiConfigPath?: string
  workspace?: { roots?: readonly string[] }
  buildCommand?: { command: string; args?: readonly string[] }
  publishCommand?: { command: string; args?: readonly string[] }
  registry?: string
}

export function defineReleaseCliConfig(config: ReleaseCliConfig) {
  return config
}

export async function loadReleaseCliConfig(cwd: string, configPath?: string) {
  const path = configPath ? resolve(cwd, configPath) : join(cwd, '.release-cli.config.ts')
  if (!existsSync(path)) return {}
  const module = await import(pathToFileURL(path).href)
  const config = module.default
  if (!config || typeof config !== 'object') {
    throw new Error(`Release CLI config must default-export an object: ${path}`)
  }
  return config as ReleaseCliConfig
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