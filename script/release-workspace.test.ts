import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ReleaseWorkspace } from './release-workspace.mts'
import { jsonVersionPaths, rootDir } from './set-version.mts'

const fixtures: string[] = []

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

async function writeManifest(cwd: string, directory: string, manifest: Record<string, unknown>) {
  const packageDirectory = join(cwd, 'packages', directory)
  await mkdir(packageDirectory, { recursive: true })
  await writeFile(join(packageDirectory, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

describe('ReleaseWorkspace', () => {
  it('discovers all current public packages including UI and excludes private applications', async () => {
    const packages = await new ReleaseWorkspace(rootDir).publishablePackages()

    expect(packages.map(pkg => pkg.name)).toEqual([
      '@delta-comic/logger',
      '@delta-comic/model',
      '@delta-comic/db',
      '@delta-comic/downloader',
      '@delta-comic/utils',
      '@delta-comic/ui',
      '@delta-comic/plugin',
    ])
    expect(packages.map(pkg => pkg.path).toSorted()).toEqual(
      jsonVersionPaths
        .filter(path => /^packages\/(?:db|downloader|logger|model|plugin|ui|utils)\//.test(path))
        .toSorted(),
    )
  })

  it('orders packages after their publishable workspace dependencies', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'delta-comic-release-workspace-'))
    fixtures.push(cwd)
    await writeManifest(cwd, 'consumer', {
      name: '@fixture/consumer',
      version: '1.0.0',
      scripts: { build: 'vp pack' },
      peerDependencies: { '@fixture/core': 'workspace:*' },
      publishConfig: { access: 'public' },
    })
    await writeManifest(cwd, 'core', {
      name: '@fixture/core',
      version: '1.0.0',
      scripts: { build: 'vp pack' },
      publishConfig: { access: 'public' },
    })
    await writeManifest(cwd, 'private-app', { name: 'private-app', private: true })

    const packages = await new ReleaseWorkspace(cwd).publishablePackages()
    expect(packages.map(pkg => pkg.name)).toEqual(['@fixture/core', '@fixture/consumer'])
  })

  it('rejects a public package without a build before release', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'delta-comic-release-workspace-'))
    fixtures.push(cwd)
    await writeManifest(cwd, 'broken', {
      name: '@fixture/broken',
      version: '1.0.0',
      publishConfig: { access: 'public' },
    })

    await expect(new ReleaseWorkspace(cwd).publishablePackages()).rejects.toThrow(
      '@fixture/broken must declare a build script',
    )
  })
})