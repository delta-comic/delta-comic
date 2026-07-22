import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const jsonVersionPaths = [
  'package.json',
  'packages/app/package.json',
  'packages/app/src-tauri/tauri.conf.json',
  'packages/db/package.json',
  'packages/downloader/package.json',
  'packages/logger/package.json',
  'packages/model/package.json',
  'packages/plugin/package.json',
  'packages/ui/package.json',
  'packages/utils/package.json',
] as const

export const cargoTomlVersionPaths = [
  ['packages/app/src-tauri/Cargo.toml', 'package'],
  ['Cargo.toml', 'workspace.package'],
] as const

export const cargoLockPackageNames = [
  'delta-comic',
  'tauri-plugin-db',
  'tauri-plugin-downloader',
  'tauri-plugin-logger',
  'tauri-plugin-plugin',
  'tauri-plugin-utils',
] as const

export const versionAssetPaths = [
  ...jsonVersionPaths,
  'packages/*/package.json',
  ...cargoTomlVersionPaths.map(([path]) => path),
  'Cargo.lock',
] as const

export const rootDir = join(import.meta.dirname, '..')

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

  constructor(cwd = rootDir) {
    this.cwd = cwd
  }

  private async versionedJsonPaths() {
    const paths = new Set<string>(jsonVersionPaths)
    const packagesDir = join(this.cwd, 'packages')
    const entries = await readdir(packagesDir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const path = join('packages', entry.name, 'package.json')
      const manifest = JSON.parse(await readFile(join(this.cwd, path), 'utf-8')) as {
        private?: boolean
      }
      if (manifest.private !== true) paths.add(path)
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

    for (const name of cargoLockPackageNames) {
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
    assertVersion(version)

    for (const path of await this.versionedJsonPaths()) {
      await this.setJsonVersion(join(this.cwd, path), version)
    }

    for (const [path, section] of cargoTomlVersionPaths) {
      await this.setCargoTomlVersion(join(this.cwd, path), version, section)
    }

    await this.setCargoLockVersion(version)
  }
}

export async function setVersion(version: string) {
  await new VersionSynchronizer().setVersion(version)
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isCli) {
  const version = process.argv[2]
  if (!version) throw new Error('Usage: node ./script/set-version.mts <version>')
  await setVersion(version)
}