import { expect, it } from 'vitest'

import { ReleaseBranchManager, type GitRunner } from '../src/release-branches.mts'
import {
  ReleaseEnvironment,
  releaseRecoveryMode,
  type GitRunner as EnvironmentGitRunner,
} from '../src/release-environment.mts'
import { createReleasePlugin } from '../src/semantic-release-plugin.mts'

function branchGit(calls: string[][], dirty = false): GitRunner {
  return async args => {
    calls.push(args)
    if (args[0] === 'status') return { status: 0, stdout: dirty ? ' M file' : '' }
    if (args[0] === 'show-ref') {
      const ref = args.at(-1)
      return { status: ref?.includes('develop') || ref?.includes('main') ? 0 : 1, stdout: '' }
    }
    if (args[0] === 'rev-parse') return { status: 0, stdout: 'same\n' }
    return { status: 0, stdout: '' }
  }
}

it('protects a clean develop preparation and injects the git runner', async () => {
  const calls: string[][] = []
  await new ReleaseBranchManager(branchGit(calls), '/tmp/fixture').execute('develop')

  expect(calls).toEqual([
    ['status', '--porcelain'],
    ['fetch', '--prune', 'origin'],
    ['show-ref', '--verify', '--quiet', 'refs/remotes/origin/develop'],
    ['show-ref', '--verify', '--quiet', 'refs/remotes/origin/develop'],
    ['show-ref', '--verify', '--quiet', 'refs/heads/develop'],
    ['switch', 'develop'],
    ['merge', '--ff-only', 'refs/remotes/origin/develop'],
    ['rev-parse', 'refs/heads/develop'],
    ['rev-parse', 'refs/remotes/origin/develop'],
    ['show-ref', '--verify', '--quiet', 'refs/remotes/origin/main'],
    ['merge', '--no-ff', '--no-edit', 'refs/remotes/origin/main'],
    ['push', 'origin', 'develop'],
  ])
})

it('stops branch operations when the worktree is dirty', async () => {
  const calls: string[][] = []
  await expect(new ReleaseBranchManager(branchGit(calls, true)).execute('develop')).rejects.toThrow(
    'worktree must be clean',
  )
  expect(calls).toEqual([['status', '--porcelain']])
})

it('cleans an ephemeral recovery tag after semantic release', async () => {
  const calls: string[][] = []
  const git: EnvironmentGitRunner = async args => {
    calls.push(args)
    if (args[0] === 'ls-remote') return { status: 0, stderr: '', stdout: '' }
    if (args[0] === 'tag' && args[1] === '--merged') {
      return { status: 0, stderr: '', stdout: '' }
    }
    if (args[0] === 'notes') return { status: 0, stderr: '', stdout: 'note abc\n' }
    if (args[0] === 'merge-base') return { status: 0, stderr: '', stdout: '' }
    return { status: 0, stderr: '', stdout: '' }
  }

  const environment = new ReleaseEnvironment({
    env: { GITHUB_REF_NAME: 'next', DELTA_RELEASE_RECOVERY: releaseRecoveryMode },
    git,
  })
  const preparation = await environment.prepare()
  expect(preparation).toEqual({ shouldRun: true, ephemeralTag: '2.0.0' })
  await environment.cleanup(preparation.ephemeralTag)
  expect(calls).toContainEqual(['tag', '--delete', '2.0.0'])
})

it('keeps semantic-release build, publish and output contracts injectable', async () => {
  const commands: Array<[string, string[]]> = []
  const outputs: string[] = []
  const plugin = createReleasePlugin({
    resolvePublishablePackages: async () => [
      {
        name: '@fixture/pkg',
        path: 'packages/pkg/package.json',
        version: '1.2.3',
        dependencies: [],
      },
    ],
    publishCommand: async (command, args) => {
      commands.push([command, args])
    },
    writeOutput: async (_path, contents) => {
      outputs.push(contents)
    },
    cleanPendingRelease: async () => undefined,
    removeEphemeralTag: async () => undefined,
    synchronizeVersion: async () => undefined,
    commitPreparedRelease: async () => undefined,
  })
  const context = {
    env: { GITHUB_OUTPUT: 'output', GITHUB_TOKEN: 'token' },
    nextRelease: { version: '1.2.3', channel: 'next', notes: 'notes' },
    branch: { name: 'next' },
  }

  await plugin.verifyConditions({}, context)
  await plugin.verifyRelease({}, context)
  await plugin.prepare({}, context)
  await plugin.publish({}, context)
  await plugin.success({}, context)

  expect(commands[0]).toEqual([
    'vp',
    ['run', '--filter', '@fixture/pkg', '--fail-if-no-match', 'build'],
  ])
  expect(commands.at(-1)?.[1]).toContain('--tag')
  expect(outputs).toContain('has-release=true\nversion=1.2.3\nchannel=next\n')
})