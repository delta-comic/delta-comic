import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createReleasePlugin } from './semantic-release-plugin.mts'
import {
  assertVersion,
  cargoLockPackageNames,
  cargoTomlVersionPaths,
  jsonVersionPaths,
  VersionSynchronizer,
} from './set-version.mts'

const fixtures: string[] = []

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

async function createVersionFixture(lineEnding: '\n' | '\r\n' = '\n') {
  const cwd = await mkdtemp(join(tmpdir(), 'delta-comic-version-edge-'))
  fixtures.push(cwd)

  for (const path of jsonVersionPaths) {
    const target = join(cwd, path)
    await mkdir(join(target, '..'), { recursive: true })
    await writeFile(target, `{${lineEnding}  "version": "1.0.0"${lineEnding}}${lineEnding}`)
  }

  for (const [path, section] of cargoTomlVersionPaths) {
    const target = join(cwd, path)
    await mkdir(join(target, '..'), { recursive: true })
    await writeFile(target, `[${section}]${lineEnding}version = "1.0.0"${lineEnding}`)
  }

  await writeFile(
    join(cwd, 'Cargo.lock'),
    cargoLockPackageNames
      .map(name => `[[package]]${lineEnding}name = "${name}"${lineEnding}version = "1.0.0"`)
      .join(`${lineEnding}${lineEnding}`),
  )
  return cwd
}

describe('semantic version validation', () => {
  it.each(['0.0.0', '1.2.3+build.9', '10.20.30-rc.1+sha-abc'])(
    'accepts release version %s',
    version => {
      expect(() => assertVersion(version)).not.toThrow()
    },
  )

  it.each(['01.2.3', '1.02.3', '1.2.03', '1.2.3-', '1.2.3+'])('rejects version %s', version => {
    expect(() => assertVersion(version)).toThrow(`Invalid semantic version: ${version}`)
  })
})

describe('VersionSynchronizer failure boundaries', () => {
  it('reports a JSON manifest that has no version before touching later files', async () => {
    const cwd = await createVersionFixture()
    const missingPath = join(cwd, jsonVersionPaths[0])
    const untouchedPath = join(cwd, jsonVersionPaths[1])
    await writeFile(missingPath, '{\n  "name": "missing-version"\n}\n')

    await expect(new VersionSynchronizer(cwd).setVersion('2.0.0')).rejects.toThrow(
      `Unable to find version field in ${missingPath}`,
    )
    expect(await readFile(untouchedPath, { encoding: 'utf-8' })).toContain('"version": "1.0.0"')
  })

  it('reports the exact Cargo section whose version is absent', async () => {
    const cwd = await createVersionFixture()
    const [path, section] = cargoTomlVersionPaths[1]
    const target = join(cwd, path)
    await writeFile(target, '[workspace]\nmembers = []\n')

    await expect(new VersionSynchronizer(cwd).setVersion('2.0.0')).rejects.toThrow(
      `Unable to find version field in ${target} [${section}]`,
    )
  })

  it('reports a missing workspace package in Cargo.lock', async () => {
    const cwd = await createVersionFixture()
    const missingPackage = cargoLockPackageNames.at(-1)
    const lockPath = join(cwd, 'Cargo.lock')
    const raw = await readFile(lockPath, { encoding: 'utf-8' })
    await writeFile(
      lockPath,
      raw.replace(
        `[[package]]\nname = "${missingPackage}"\nversion = "1.0.0"`,
        '[[package]]\nname = "unrelated"\nversion = "1.0.0"',
      ),
    )

    await expect(new VersionSynchronizer(cwd).setVersion('2.0.0')).rejects.toThrow(
      `Unable to find version field in Cargo.lock package ${missingPackage}`,
    )
  })

  it('updates Cargo.lock entries with Windows line endings', async () => {
    const cwd = await createVersionFixture('\r\n')
    await new VersionSynchronizer(cwd).setVersion('2.0.0')

    const lock = await readFile(join(cwd, 'Cargo.lock'), { encoding: 'utf-8' })
    expect(lock.match(/version = "2\.0\.0"/g)).toHaveLength(cargoLockPackageNames.length)
    expect(lock).toContain('\r\n')
  })
})

describe('semantic-release default output writer', () => {
  it('appends the release result to the GitHub Actions output file', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'delta-comic-release-output-'))
    fixtures.push(cwd)
    const outputPath = join(cwd, 'github-output')
    await writeFile(outputPath, 'previous=true\n')
    const synchronizeVersion = vi.fn<(version: string) => Promise<void>>().mockResolvedValue()
    const plugin = createReleasePlugin({ synchronizeVersion })

    await plugin.verifyRelease(
      {},
      {
        env: { GITHUB_OUTPUT: outputPath, GITHUB_TOKEN: 'secret' },
        nextRelease: { version: '4.0.0' },
      },
    )

    await expect(readFile(outputPath, { encoding: 'utf-8' })).resolves.toBe(
      'previous=true\nhas-release=true\nversion=4.0.0\nchannel=latest\n',
    )
    expect(synchronizeVersion).not.toHaveBeenCalled()
  })
})