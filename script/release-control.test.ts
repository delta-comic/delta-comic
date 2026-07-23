import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PublishableWorkspacePackage } from './release-workspace.mts'
import {
  createReleasePlugin,
  resolveDistTag,
  type CommandRunner,
} from './semantic-release-plugin.mts'
import {
  cargoLockPackageNames,
  cargoTomlVersionPaths,
  jsonVersionPaths,
  VersionSynchronizer,
} from './set-version.mts'

const fixtures: string[] = []

const publishablePackages: PublishableWorkspacePackage[] = [
  {
    dependencies: [],
    name: '@delta-comic/model',
    path: 'packages/model/package.json',
    version: '3.0.0',
  },
  {
    dependencies: ['@delta-comic/model'],
    name: '@delta-comic/ui',
    path: 'packages/ui/package.json',
    version: '3.0.0',
  },
]

const resolvePublishablePackages = vi.fn(async () => publishablePackages)

beforeEach(() => {
  resolvePublishablePackages.mockClear()
})

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

async function createVersionFixture() {
  const cwd = await mkdtemp(join(tmpdir(), 'delta-comic-version-'))
  fixtures.push(cwd)

  for (const path of jsonVersionPaths) {
    const target = join(cwd, path)
    await mkdir(join(target, '..'), { recursive: true })
    await writeFile(target, '{\n  "name": "fixture",\n  "version": "1.0.0"\n}\n')
  }

  for (const [path, section] of cargoTomlVersionPaths) {
    const target = join(cwd, path)
    await mkdir(join(target, '..'), { recursive: true })
    await writeFile(target, `[${section}]\nname = "fixture"\nversion = "1.0.0"\n`)
  }

  await writeFile(
    join(cwd, 'Cargo.lock'),
    cargoLockPackageNames
      .map(name => `[[package]]\nname = "${name}"\nversion = "1.0.0"\n`)
      .join('\n'),
  )
  return cwd
}

describe('VersionSynchronizer', () => {
  it('keeps every JavaScript, Tauri and Rust manifest on one version', async () => {
    const cwd = await createVersionFixture()
    await new VersionSynchronizer(cwd).setVersion('3.1.0-beta.2')

    for (const path of jsonVersionPaths) {
      const pkg = JSON.parse(await readFile(join(cwd, path), { encoding: 'utf-8' })) as {
        version: string
      }
      expect(pkg.version).toBe('3.1.0-beta.2')
    }
    for (const [path] of cargoTomlVersionPaths) {
      expect(await readFile(join(cwd, path), { encoding: 'utf-8' })).toContain(
        'version = "3.1.0-beta.2"',
      )
    }
    const cargoLock = await readFile(join(cwd, 'Cargo.lock'), { encoding: 'utf-8' })
    expect(cargoLock.match(/version = "3\.1\.0-beta\.2"/g)).toHaveLength(
      cargoLockPackageNames.length,
    )
  })

  it('rejects malformed versions before editing files', async () => {
    const cwd = await createVersionFixture()
    await expect(new VersionSynchronizer(cwd).setVersion('next')).rejects.toThrow(
      'Invalid semantic version',
    )
  })

  it('automatically synchronizes a newly added public workspace package', async () => {
    const cwd = await createVersionFixture()
    const manifestPath = join(cwd, 'packages/new-library/package.json')
    await mkdir(join(manifestPath, '..'), { recursive: true })
    await writeFile(
      manifestPath,
      '{\n  "name": "@delta-comic/new-library",\n  "version": "1.0.0"\n}\n',
    )

    await new VersionSynchronizer(cwd).setVersion('3.2.0')

    await expect(readFile(manifestPath, 'utf-8')).resolves.toContain('"version": "3.2.0"')
  })
})

describe('semantic-release monorepo plugin', () => {
  it('maps stable and preview channels to safe npm dist-tags', () => {
    expect(resolveDistTag()).toBe('latest')
    expect(resolveDistTag('next')).toBe('next')
    expect(() => resolveDistTag('../next')).toThrow('Invalid npm dist-tag')
  })

  it('reports and prepares the version calculated by semantic-release', async () => {
    const synchronizeVersion = vi.fn<(version: string) => Promise<void>>().mockResolvedValue()
    const cleanPendingRelease = vi.fn<(version: string) => Promise<void>>().mockResolvedValue()
    const removeEphemeralTag = vi
      .fn<(env: NodeJS.ProcessEnv) => Promise<void>>()
      .mockResolvedValue()
    const writeOutput = vi
      .fn<(path: string, contents: string) => Promise<void>>()
      .mockResolvedValue()
    const plugin = createReleasePlugin({
      resolvePublishablePackages,
      cleanPendingRelease,
      removeEphemeralTag,
      synchronizeVersion,
      writeOutput,
    })
    const context = {
      env: { GITHUB_OUTPUT: '/tmp/output', NPM_TOKEN: 'secret' },
      nextRelease: { version: '3.0.0' },
    }

    await plugin.verifyConditions({}, context)
    await plugin.verifyRelease({}, context)
    await plugin.prepare({}, context)

    expect(writeOutput).toHaveBeenCalledWith(
      '/tmp/output',
      'has-release=true\nversion=3.0.0\nchannel=latest\n',
    )
    expect(synchronizeVersion).toHaveBeenCalledWith('3.0.0')
    expect(removeEphemeralTag).toHaveBeenCalledWith(context.env)
    expect(cleanPendingRelease).toHaveBeenCalledWith('3.0.0')
  })

  it('builds every publishable package in dependency order before recursively publishing', async () => {
    const publishCommand = vi.fn<CommandRunner>().mockResolvedValue()
    const plugin = createReleasePlugin({ publishCommand, resolvePublishablePackages })
    await plugin.publish({}, { env: {}, nextRelease: { version: '3.0.0' } })

    expect(publishCommand.mock.calls).toEqual([
      ['vp', ['run', '--filter', '@delta-comic/model', '--fail-if-no-match', 'build']],
      ['vp', ['run', '--filter', '@delta-comic/ui', '--fail-if-no-match', 'build']],
      ['vp', ['pm', 'publish', '-r', '--no-git-checks', '--provenance', '--tag', 'latest']],
    ])
  })

  it('publishes preview packages under the next dist-tag', async () => {
    const publishCommand = vi.fn<CommandRunner>().mockResolvedValue()
    const plugin = createReleasePlugin({
      publishCommand,
      resolvePublishablePackages: async () =>
        publishablePackages.map(pkg => ({ ...pkg, version: '3.1.0-next.1' })),
    })
    await plugin.publish({}, { env: {}, nextRelease: { channel: 'next', version: '3.1.0-next.1' } })

    expect(publishCommand).toHaveBeenLastCalledWith('vp', [
      'pm',
      'publish',
      '-r',
      '--no-git-checks',
      '--provenance',
      '--tag',
      'next',
    ])
  })

  it('requires an npm token before publishing', async () => {
    const plugin = createReleasePlugin({ resolvePublishablePackages })

    await expect(
      plugin.verifyConditions({}, { env: {}, nextRelease: { version: '3.0.0' } }),
    ).rejects.toThrow('NPM_TOKEN is required')
    expect(resolvePublishablePackages).not.toHaveBeenCalled()
  })

  it('validates release versions and skips GitHub output outside Actions', async () => {
    const writeOutput = vi.fn()
    const plugin = createReleasePlugin({ writeOutput })

    await expect(
      plugin.verifyRelease({}, { env: {}, nextRelease: { version: 'next' } }),
    ).rejects.toThrow('Invalid semantic version')
    await plugin.verifyRelease({}, { env: {}, nextRelease: { version: '3.0.0' } })
    expect(writeOutput).not.toHaveBeenCalled()
  })

  it('does not publish packages when the library build fails', async () => {
    const publishCommand = vi.fn<CommandRunner>().mockRejectedValueOnce(new Error('build failed'))
    const plugin = createReleasePlugin({ publishCommand, resolvePublishablePackages })

    await expect(
      plugin.publish({}, { env: {}, nextRelease: { version: '3.0.0' } }),
    ).rejects.toThrow('build failed')
    expect(publishCommand).toHaveBeenCalledExactlyOnceWith('vp', [
      'run',
      '--filter',
      '@delta-comic/model',
      '--fail-if-no-match',
      'build',
    ])
  })

  it('refuses to publish a workspace with unsynchronized package versions', async () => {
    const publishCommand = vi.fn<CommandRunner>().mockResolvedValue()
    const plugin = createReleasePlugin({
      publishCommand,
      resolvePublishablePackages: async () => [{ ...publishablePackages[0], version: '2.9.0' }],
    })

    await expect(
      plugin.publish({}, { env: {}, nextRelease: { version: '3.0.0' } }),
    ).rejects.toThrow('@delta-comic/model@2.9.0')
    expect(publishCommand).not.toHaveBeenCalled()
  })

  it('adds a bold safety warning only to prerelease notes', async () => {
    const plugin = createReleasePlugin({ resolvePublishablePackages })

    await expect(
      plugin.generateNotes(
        {},
        { env: {}, nextRelease: { channel: 'next', version: '3.1.0-next.1' } },
      ),
    ).resolves.toMatch(/^\*\*谨慎更新：.*\*\*$/)
    await expect(
      plugin.generateNotes({}, { env: {}, nextRelease: { version: '3.1.0' } }),
    ).resolves.toBe('')
  })

  it('commits prepared versions only after publishing succeeds', async () => {
    const commitPreparedRelease = vi.fn().mockResolvedValue(undefined)
    const plugin = createReleasePlugin({ commitPreparedRelease, resolvePublishablePackages })

    await plugin.success(
      {},
      {
        branch: { name: 'next' },
        env: {},
        nextRelease: { channel: 'next', notes: 'release notes', version: '3.0.0-next.2' },
      },
    )

    expect(commitPreparedRelease).toHaveBeenCalledExactlyOnceWith(
      '3.0.0-next.2',
      'release notes',
      'next',
    )
  })
})