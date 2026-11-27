import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { runInNewContext } from 'node:vm'

import { parseModuleManifest } from '@delta-comic/platform/manifest'
import JSZip from 'jszip'
import { expect, it } from 'vite-plus/test'
import * as vue from 'vue'

const run = promisify(execFile)
const fixtures = join(import.meta.dirname, '../fixtures')
const build = (dir: string) => run(process.execPath, [join(fixtures, 'build.mjs'), dir])

async function registration(dir: string) {
  const zip = await JSZip.loadAsync(await readFile(join(dir, 'dist/plugin.zip')))
  const manifest = parseModuleManifest(JSON.parse(await zip.file('manifest.json')!.async('string')))
  for (const { path, integrity } of manifest.resources) {
    const bytes = await zip.file(path)!.async('uint8array')
    expect('sha256-' + createHash('sha256').update(bytes).digest('base64')).toBe(integrity)
  }
  const register = await zip.file(manifest.script)!.async('string')
  const records: {
    package: string
    factory: (resolve: (id: string) => object) => {
      modules: Record<string, any>
      components: unknown[]
    }
  }[] = []
  runInNewContext(register, {
    __deltaComicRegister: (record: (typeof records)[number]) => records.push(record),
  })
  expect(records.map(record => record.package)).toEqual([manifest.package])
  return { factory: records[0].factory, manifest }
}

it('builds independently typed packages and executes their archived registration scripts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dc-modules-'))
  const parser = join(root, 'parser')
  const catalog = join(root, 'catalog')
  try {
    for (const dir of [parser, catalog]) {
      await cp(join(fixtures, basename(dir)), dir, {
        recursive: true,
        filter: path => !['dist', 'node_modules'].includes(basename(path)),
      })
    }
    await mkdir(join(catalog, 'node_modules/@fixture'), { recursive: true })
    await symlink(parser, join(catalog, 'node_modules/@fixture/parser'), 'dir')
    await build(parser)
    await run(process.execPath, [
      fileURLToPath(import.meta.resolve('typescript/bin/tsc')),
      '--noEmit',
      '-p',
      catalog,
    ])
    await build(catalog)
    const provider = await registration(parser)
    const { modules } = provider.factory(() => {
      throw new Error('unexpected external')
    })
    const consumer = await registration(catalog)
    expect(consumer.manifest.externals).toEqual([
      '@fixture/parser/lazy',
      '@fixture/parser/text',
      'vue',
    ])
    expect(consumer.manifest.resources.map(r => r.path)).toContain('index.css')
    const requests: string[] = []
    const result = consumer.factory(id => {
      requests.push(id)
      if (id === 'vue') return vue
      return modules[id.replace('@fixture/parser', '.')]
    })
    const api = result.modules['.']
    expect(result.components).toHaveLength(1)
    expect(api.title).toBe('Delta')
    expect(api.count).toBe(0)
    modules['./text'].increment()
    expect(api.count).toBe(1)
    expect(requests).not.toContain('@fixture/parser/lazy')
    expect(await api.lazy()).toBe(modules['./lazy'])
    expect(api.state).toBe(modules['./lazy'].state)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}, 30000)