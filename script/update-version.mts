import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const version = process.argv0

const path = join(import.meta.dirname, '../src-tauri/tauri.conf.json')
const tauri: typeof import('../src-tauri/tauri.conf.json') = JSON.parse(
  await readFile(path, { encoding: 'utf-8' })
)
tauri.version = version
await writeFile(path, JSON.stringify(tauri, null, 2), { encoding: 'utf-8' })