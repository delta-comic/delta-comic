import TOML from '@iarna/toml'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function setVersion(version: string) {
  {
    const path = join(import.meta.dirname, '../package.json')
    const pkg: typeof import('../package.json') = JSON.parse(
      await readFile(path, { encoding: 'utf-8' })
    )
    pkg.version = version
    await writeFile(path, JSON.stringify(pkg, null, 2), { encoding: 'utf-8' })
  }

  {
    const path = join(import.meta.dirname, '../src-tauri/tauri.conf.json')
    const tauri: typeof import('../src-tauri/tauri.conf.json') = JSON.parse(
      await readFile(path, { encoding: 'utf-8' })
    )
    tauri.version = version
    await writeFile(path, JSON.stringify(tauri, null, 2), { encoding: 'utf-8' })
  }

  {
    const path = join(import.meta.dirname, '../src-tauri/Cargo.toml')
    const cargo = TOML.parse(await readFile(path, { encoding: 'utf-8' }))
    ;(cargo.package as TOML.JsonMap).version = version
    await writeFile(path, TOML.stringify(cargo), { encoding: 'utf-8' })
  }
}

const version = process.argv[2]
if (version) await setVersion(version)