import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import TOML from '@iarna/toml'

const packageJsonPaths = [
  '../packages/app/package.json',
  '../packages/app/src-tauri/tauri.conf.json',
  '../packages/core/package.json',
  '../packages/db/package.json',
  '../packages/model/package.json',
  '../packages/plugin/package.json',
  '../packages/request/package.json',
  '../packages/ui/package.json',
  '../packages/utils/package.json',
  '../packages/vite/package.json'
]
const cargoTomlPaths = ['../packages/app/src-tauri/Cargo.toml']
export async function setVersion(version: string) {
  for (const p of packageJsonPaths) {
    const path = join(import.meta.dirname, p)
    const pkg: { version: string } = JSON.parse(await readFile(path, { encoding: 'utf-8' }))
    pkg.version = version
    await writeFile(path, JSON.stringify(pkg, null, 2), { encoding: 'utf-8' })
  }

  for (const p of cargoTomlPaths) {
    const path = join(import.meta.dirname, p)
    const cargo = TOML.parse(await readFile(path, { encoding: 'utf-8' }))
    ;(cargo.package as TOML.JsonMap).version = version
    await writeFile(path, TOML.stringify(cargo), { encoding: 'utf-8' })
  }
}

const version = process.argv[2]
if (version) await setVersion(version)