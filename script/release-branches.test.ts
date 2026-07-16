import { describe, expect, it, vi } from 'vitest'

import {
  describeReleaseBranchAction,
  parseReleaseBranchArgs,
  ReleaseBranchManager,
  type GitRunner,
} from './release-branches.mts'

interface GitFixture {
  dirty?: boolean
  hashes?: Record<string, string>
  refs?: string[]
}

function createGitFixture({ dirty = false, hashes = {}, refs = [] }: GitFixture = {}) {
  const knownRefs = new Set(refs)
  const git = vi.fn<GitRunner>(async args => {
    if (args[0] === 'status') return { status: 0, stdout: dirty ? ' M package.json\n' : '' }
    if (args[0] === 'show-ref') {
      return { status: knownRefs.has(args.at(-1) ?? '') ? 0 : 1, stdout: '' }
    }
    if (args[0] === 'rev-parse') {
      const ref = args[1]
      return { status: 0, stdout: `${hashes[ref] ?? 'same-sha'}\n` }
    }
    return { status: 0, stdout: '' }
  })
  return git
}

describe('release branch CLI', () => {
  it('parses promotion and dry-run options', () => {
    expect(parseReleaseBranchArgs(['preview', '--dry-run'])).toEqual({
      action: 'preview',
      dryRun: true,
      help: false,
    })
    expect(parseReleaseBranchArgs(['--help']).help).toBe(true)
    expect(() => parseReleaseBranchArgs(['production'])).toThrow('Unknown or missing')
    expect(() => parseReleaseBranchArgs(['preview', 'stable'])).toThrow('Unknown or missing')
    expect(() => parseReleaseBranchArgs(['stable', '--force'])).toThrow('Unknown option')
  })

  it('describes plans without running git', () => {
    expect(describeReleaseBranchAction('develop')).toContain('No git command was executed')
    expect(describeReleaseBranchAction('preview')).toContain('develop -> next')
    expect(describeReleaseBranchAction('stable')).toContain('next -> main')
  })
})

describe('ReleaseBranchManager', () => {
  it('refuses branch operations with a dirty worktree', async () => {
    const git = createGitFixture({ dirty: true })
    await expect(new ReleaseBranchManager(git).promote('preview')).rejects.toThrow(
      'worktree must be clean',
    )
    expect(git).toHaveBeenCalledExactlyOnceWith(['status', '--porcelain'])
  })

  it('bootstraps develop from origin/main without triggering a release branch', async () => {
    const git = createGitFixture({ refs: ['refs/remotes/origin/main'] })
    await new ReleaseBranchManager(git).prepareDevelop()

    expect(git).toHaveBeenCalledWith(['switch', '-c', 'develop', 'refs/remotes/origin/main'])
    expect(git).toHaveBeenCalledWith(['push', '--set-upstream', 'origin', 'develop'])
  })

  it('merges a completed stable release back into develop', async () => {
    const refs = ['refs/remotes/origin/develop', 'refs/heads/develop', 'refs/remotes/origin/main']
    const git = createGitFixture({ refs })
    await new ReleaseBranchManager(git).prepareDevelop()

    expect(git).toHaveBeenCalledWith(['merge', '--no-ff', '--no-edit', 'refs/remotes/origin/main'])
    expect(git).toHaveBeenCalledWith(['push', 'origin', 'develop'])
  })

  it('merges an exact develop branch into the synchronized preview branch', async () => {
    const refs = [
      'refs/remotes/origin/develop',
      'refs/heads/develop',
      'refs/remotes/origin/next',
      'refs/heads/next',
    ]
    const git = createGitFixture({ refs })
    await new ReleaseBranchManager(git).promote('preview')

    expect(git).toHaveBeenCalledWith(['merge', '--no-ff', '--no-edit', 'develop'])
    expect(git).toHaveBeenCalledWith(['push', 'origin', 'next'])
    expect(git).toHaveBeenLastCalledWith(['switch', 'develop'])
  })

  it('creates next from develop on the first preview promotion', async () => {
    const refs = ['refs/remotes/origin/develop', 'refs/heads/develop']
    const git = createGitFixture({ refs })
    await new ReleaseBranchManager(git).promote('preview')

    expect(git).toHaveBeenCalledWith(['switch', '-c', 'next', 'develop'])
    expect(git).toHaveBeenCalledWith(['push', '--set-upstream', 'origin', 'next'])
  })

  it('does not promote local-only commits from a source branch', async () => {
    const refs = ['refs/remotes/origin/next', 'refs/heads/next']
    const hashes = { 'refs/heads/next': 'local-sha', 'refs/remotes/origin/next': 'remote-sha' }
    const git = createGitFixture({ hashes, refs })

    await expect(new ReleaseBranchManager(git).promote('stable')).rejects.toThrow(
      'not synchronized',
    )
    expect(git).not.toHaveBeenCalledWith(['push', 'origin', 'main'])
  })
})