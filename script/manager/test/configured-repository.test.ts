import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, it } from 'vitest'

import { VersionSynchronizer } from '../src/set-version.mts'
import { writeWindowsMsiConfig } from '../src/windows-msi-version.mts'

it('synchronizes configured JSON, Cargo, lockfile and MSI targets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'delta-release-fixture-'))
  try {
    await writeFile(
      join(directory, 'package.json'),
      '{\n  "name": "fixture",\n  "version": "1.0.0"\n}\n',
    )
    await writeFile(
      join(directory, 'Cargo.toml'),
      '[workspace.package]\nversion = "1.0.0"\n\n[package]\nversion = "1.0.0"\n',
    )
    await writeFile(
      join(directory, 'Cargo.lock'),
      '[[package]]\nname = "fixture"\nversion = "1.0.0"\n',
    )

    const config = {
      jsonVersionPaths: ['package.json'],
      cargoTomlVersionPaths: [['Cargo.toml', 'workspace.package'] as const],
      cargoLockPackageNames: ['fixture'],
      msiConfigPath: 'build/windows.json',
    }
    expect(await new VersionSynchronizer(directory, config).plan('1.2.3-next.4')).toEqual([
      'package.json',
      'Cargo.toml',
      'Cargo.lock',
    ])

    await new VersionSynchronizer(directory, config).setVersion('1.2.3-next.4')
    expect(await readFile(join(directory, 'package.json'), 'utf8')).toContain('1.2.3-next.4')
    expect(await readFile(join(directory, 'Cargo.toml'), 'utf8')).toContain(
      'version = "1.2.3-next.4"',
    )
    expect(await readFile(join(directory, 'Cargo.lock'), 'utf8')).toContain(
      'version = "1.2.3-next.4"',
    )

    await writeWindowsMsiConfig('1.2.3-next.4', directory, config.msiConfigPath)
    expect(await readFile(join(directory, config.msiConfigPath), 'utf8')).toContain('1.2.3.4')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})