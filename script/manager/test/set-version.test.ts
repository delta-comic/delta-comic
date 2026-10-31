import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { expect, it } from 'vitest'

import {
  cargoTomlVersionPaths,
  jsonVersionPaths,
  rootDir,
  VersionSynchronizer,
} from '../set-version.mts'

it('keeps the internal HTTP crate lock version aligned during a release', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'delta-version-'))
  try {
    const paths = [
      ...jsonVersionPaths,
      ...cargoTomlVersionPaths.map(([path]) => path),
      'Cargo.lock',
    ]
    for (const path of paths) {
      const target = join(directory, path)
      await mkdir(dirname(target), { recursive: true })
      await cp(join(rootDir, path), target)
    }

    const version = '99.0.0-test.1'
    await new VersionSynchronizer(directory).setVersion(version)

    const manifest = await readFile(join(directory, 'Cargo.toml'), 'utf8')
    const lock = await readFile(join(directory, 'Cargo.lock'), 'utf8')
    expect(manifest).toContain(`version = "${version}"`)
    const httpVersion = lock.match(
      /\[\[package\]\]\nname = "tauri-plugin-http"\nversion = "([^"]+)"/,
    )
    expect(httpVersion?.[1]).toBe(version)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})