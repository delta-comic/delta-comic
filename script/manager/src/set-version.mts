import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { ReleaseCliConfig } from './config.mts'

export const jsonVersionPaths = [
  'package.json',
  'packages/client/app/mobile/package.json',
  'packages/client/app/desktop/package.json',
  'packages/client/app/core/package.json',
  'packages/client/core/sdk/package.json',
  'packages/client/app/mobile/src-tauri/tauri.conf.json',
  'packages/client/app/desktop/src-tauri/tauri.conf.json',
  'packages/client/data/db/package.json',
  'packages/client/platform/downloader/package.json',
  'packages/client/platform/http/package.json',
  'packages/shared/core/logger/package.json',
  'packages/client/core/model/package.json',
  'packages/shared/plugin/manifest/package.json',
  'packages/client/core/plugin-artifact/package.json',
  'packages/client/core/plugin-install/package.json',
  'packages/client/core/plugin-vite/package.json',
  'packages/client/core/plugin/package.json',
  'packages/server/core/server/package.json',
  'packages/shared/core/both/package.json',
  'packages/client/ui/ui/package.json',
  'packages/client/core/utils/package.json',
] as const

export const cargoTomlVersionPaths = [
  ['packages/client/app/mobile/src-tauri/Cargo.toml', 'package'],
  ['packages/client/app/desktop/src-tauri/Cargo.toml', 'package'],
  ['Cargo.toml', 'workspace.package'],
] as const

export const cargoLockPackageNames = [
  'delta-comic-mobile',
  'delta-comic-desktop',
  'delta-comic-native',
  'tauri-plugin-db',
  'tauri-plugin-downloader',
  'tauri-plugin-http',
  'tauri-plugin-logger',
  'tauri-plugin-plugin',
  'tauri-plugin-utils',
] as const

export const versionAssetPaths = [
  ...jsonVersionPaths,
  'packages/*/*/*/package.json',
  ...cargoTomlVersionPaths.map(([path]) => path),
  'Cargo.lock',
] as const

export const rootDir = process.cwd()

const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

function replaceVersion(raw: string, pattern: RegExp, version: string, label: string) {
  if (!pattern.test(raw)) throw new Error(`Unable to find version field in ${label}`)
  pattern.lastIndex = 0
  return raw.replace(pattern, `$1${version}$2`)
}

export function assertVersion(version: string) {
  if (!semverPattern.test(version)) throw new Error(`Invalid semantic version: ${version}`)
}

export class VersionSynchronizer {
  private readonly cwd: string
  private readonly config: ReleaseCliConfig

  constructor(cwd = rootDir, config: ReleaseCliConfig = {}) {
    this.cwd = cwd
    this.config = config
  }

  private async versionedJsonPaths() {
    const paths = new Set<string>(this.config.jsonVersionPaths ?? ['package.json'])
    const packageRoots = this.config.workspace?.roots ?? ['packages']

    const visit = async (directory: string) => {
      const entries = await readdir(directory, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue
        const path = join(directory, entry.name)
        if (entry.isDirectory()) {
          await visit(path)
          continue
        }
        if (!entry.isFile() || entry.name !== 'package.json') continue
        const relativePath = path.slice(this.cwd.length + 1)
        if (paths.has(relativePath)) continue
        const manifest = JSON.parse(await readFile(path, 'utf-8')) as { private?: boolean }
        if (manifest.private !== true) paths.add(relativePath)
      }
    }

    for (const packageRoot of packageRoots) {
      try {
        await visit(join(this.cwd, packageRoot))
      } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
      }
    }

    return [...paths]
  }

  private async setJsonVersion(path: string, version: string) {
    const raw = await readFile(path, { encoding: 'utf-8' })
    const pkg = JSON.parse(raw) as { version?: string }
    if (typeof pkg.version !== 'string') throw new Error(`Unable to find version field in ${path}`)
    await writeFile(path, replaceVersion(raw, /("version"\s*:\s*")[^"]+(")/, version, path), {
      encoding: 'utf-8',
    })
  }

  private async setCargoTomlVersion(
    path: string,
    version: string,
    section: 'package' | 'workspace.package',
  ) {
    const raw = await readFile(path, { encoding: 'utf-8' })
    const pattern =
      section === 'workspace.package'
        ? /(\[workspace\.package\][\s\S]*?^version = ")[^"]+(")/m
        : /(\[package\][\s\S]*?^version = ")[^"]+(")/m
    await writeFile(path, replaceVersion(raw, pattern, version, `${path} [${section}]`), {
      encoding: 'utf-8',
    })
  }

  private async setCargoLockVersion(version: string) {
    const path = join(this.cwd, 'Cargo.lock')
    const raw = await readFile(path, { encoding: 'utf-8' })
    let next = raw

    for (const name of this.config.cargoLockPackageNames ?? []) {
      next = replaceVersion(
        next,
        new RegExp(`(\\[\\[package\\]\\]\\r?\\nname = "${name}"\\r?\\nversion = ")[^"]+(")`, 'g'),
        version,
        `Cargo.lock package ${name}`,
      )
    }

    await writeFile(path, next, { encoding: 'utf-8' })
  }

  async setVersion(version: string) {
    await this.plan(version)

    for (const path of await this.versionedJsonPaths()) {
      await this.setJsonVersion(join(this.cwd, path), version)
    }

    for (const [path, section] of this.config.cargoTomlVersionPaths ?? []) {
      await this.setCargoTomlVersion(join(this.cwd, path), version, section)
    }

    if (this.config.cargoLockPackageNames?.length) await this.setCargoLockVersion(version)
  }

  async plan(version: string) {
    assertVersion(version)
    const paths = await this.versionedJsonPaths()
    const cargoPaths = this.config.cargoTomlVersionPaths ?? []
    for (const path of paths) await this.validateJson(join(this.cwd, path))
    for (const [path, section] of cargoPaths)
      await this.validateCargo(join(this.cwd, path), section)
    const lockNames = this.config.cargoLockPackageNames ?? []
    if (lockNames.length) await this.validateCargoLock()
    return [
      ...paths,
      ...cargoPaths.map(([path]) => path),
      ...(lockNames.length ? ['Cargo.lock'] : []),
    ]
  }

  private async validateJson(path: string) {
    const raw = await readFile(path, 'utf8')
    const pkg = JSON.parse(raw) as { version?: string }
    if (typeof pkg.version !== 'string') throw new Error(`Unable to find version field in ${path}`)
  }

  private async validateCargo(path: string, section: 'package' | 'workspace.package') {
    const raw = await readFile(path, 'utf8')
    const pattern =
      section === 'workspace.package'
        ? /(\[workspace\.package\][\s\S]*?^version = ")[^"]+("\s*)/m
        : /(\[package\][\s\S]*?^version = ")[^"]+("\s*)/m
    if (!pattern.test(raw)) throw new Error(`Unable to find version field in ${path} [${section}]`)
  }

  private async validateCargoLock() {
    const raw = await readFile(join(this.cwd, 'Cargo.lock'), 'utf8')
    for (const name of this.config.cargoLockPackageNames ?? cargoLockPackageNames) {
      const pattern = new RegExp(`\\[\\[package\\]\\]\\r?\\nname = "${name}"\\r?\\nversion = "`)
      if (!pattern.test(raw)) throw new Error(`Unable to find Cargo.lock package ${name}`)
    }
  }
}

export async function setVersion(version: string, cwd = rootDir) {
  await new VersionSynchronizer(cwd).setVersion(version)
}