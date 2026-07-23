import { describe, expect, it, vi } from 'vitest'

import {
  type GitResult,
  type GitRunner,
  hasRecoveredRelease,
  ReleaseEnvironment,
  releaseRecoveryMode,
  removeEphemeralReleaseTag,
} from './release-environment.mts'

const ok = (stdout = ''): GitResult => ({ status: 0, stderr: '', stdout })

describe('release recovery state', () => {
  it('recognizes recovered preview and stable branches independently', () => {
    expect(hasRecoveredRelease('next', ['3.0.0-next.1'])).toBe(true)
    expect(hasRecoveredRelease('next', ['3.0.0'])).toBe(true)
    expect(hasRecoveredRelease('main', ['3.0.0-next.1'])).toBe(false)
    expect(hasRecoveredRelease('main', ['3.0.0'])).toBe(true)
    expect(hasRecoveredRelease('next', ['2.3.0', 'v1.3.0'])).toBe(false)
  })

  it('blocks automatic release until recovery is explicitly enabled', async () => {
    const writes: [string, string][] = []
    const git = vi.fn<GitRunner>(async args => {
      if (args[0] === 'tag') return ok('1.3.0\n')
      if (args[0] === 'ls-remote') return ok('tag-sha\trefs/tags/1.3.0\n')
      return ok()
    })
    const environment = new ReleaseEnvironment({
      env: {
        GITHUB_OUTPUT: '/tmp/output',
        GITHUB_REF_NAME: 'next',
        GITHUB_STEP_SUMMARY: '/tmp/summary',
      },
      git,
      writeOutput: async (path, contents) => {
        writes.push([path, contents])
      },
    })

    await expect(environment.prepare()).resolves.toEqual({ shouldRun: false })
    expect(writes).toContainEqual(['/tmp/output', 'has-release=false\nrecovery-required=true\n'])
    expect(git.mock.calls.flatMap(call => call[0]).join(' ')).not.toContain('notes')
  })

  it('creates the withdrawn baseline at the original noted commit only for recovery', async () => {
    const calls: string[][] = []
    const git = vi.fn<GitRunner>(async (args, options) => {
      calls.push(args)
      if (args[0] === 'tag' && args.includes('--list')) return ok('1.3.0\n')
      if (args[0] === 'ls-remote') return ok('tag-sha\trefs/tags/1.3.0\n')
      if (args[0] === 'notes') return ok('note-sha original-release-sha\n')
      if (args[0] === 'merge-base' && options?.allowFailure) return ok()
      return ok()
    })
    const environment = new ReleaseEnvironment({
      env: { DELTA_RELEASE_RECOVERY: releaseRecoveryMode, GITHUB_REF_NAME: 'next' },
      git,
    })

    await expect(environment.prepare()).resolves.toEqual({ ephemeralTag: '2.0.0', shouldRun: true })
    expect(calls).toContainEqual(['tag', '--no-sign', '2.0.0', 'original-release-sha'])
  })

  it('rejects unrelated local-only tags before semantic-release can push all tags', async () => {
    const git = vi.fn<GitRunner>(async args => {
      if (args[0] === 'tag') return ok('1.3.0\nlocal-test\n')
      if (args[0] === 'ls-remote') return ok('tag-sha\trefs/tags/1.3.0\n')
      return ok()
    })
    const environment = new ReleaseEnvironment({ env: { GITHUB_REF_NAME: 'next' }, git })

    await expect(environment.prepare()).rejects.toThrow('local-only tags: local-test')
  })

  it('removes only the expected ephemeral tag before semantic-release pushes', async () => {
    const git = vi.fn<GitRunner>(async () => ok())

    await removeEphemeralReleaseTag({ DELTA_RELEASE_EPHEMERAL_TAG: '2.0.0' }, git)
    expect(git).toHaveBeenCalledExactlyOnceWith(['tag', '--delete', '2.0.0'], {
      allowFailure: true,
    })
    await expect(
      removeEphemeralReleaseTag({ DELTA_RELEASE_EPHEMERAL_TAG: 'unexpected' }, git),
    ).rejects.toThrow('unexpected ephemeral tag')
  })
})