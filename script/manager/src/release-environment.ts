import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { rootDir } from './set-version'

const execFileAsync = promisify(execFile)

export interface GitResult {
  status: number
  stderr: string
  stdout: string
}

export type GitRunner = (args: string[], options?: { allowFailure?: boolean }) => Promise<GitResult>

export function createGitRunner(cwd = rootDir): GitRunner {
  return async (args, options = {}) => {
    try {
      const result = await execFileAsync('git', args, { cwd, encoding: 'utf-8' })
      return { status: 0, stderr: result.stderr, stdout: result.stdout }
    } catch (error) {
      const result = {
        status: typeof error === 'object' && error && 'code' in error ? Number(error.code) : 1,
        stderr:
          typeof error === 'object' && error && 'stderr' in error ? String(error.stderr ?? '') : '',
        stdout:
          typeof error === 'object' && error && 'stdout' in error ? String(error.stdout ?? '') : '',
      }
      if (options.allowFailure) return result
      throw error
    }
  }
}

function remoteTagNames(output: string) {
  return new Set(
    output
      .split('\n')
      .map(line => line.trim().split(/\s+/)[1])
      .filter((ref): ref is string => Boolean(ref?.startsWith('refs/tags/')))
      .map(ref => ref.replace(/^refs\/tags\//, '').replace(/\^\{\}$/, '')),
  )
}

interface ReleaseEnvironmentOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  git?: GitRunner
  writeOutput?: (path: string, contents: string) => Promise<void>
}

export class ReleaseEnvironment {
  private readonly env: NodeJS.ProcessEnv
  private readonly git: GitRunner

  constructor({
    env = process.env,
    cwd = rootDir,
    git = createGitRunner(cwd),
  }: ReleaseEnvironmentOptions = {}) {
    this.env = env
    this.git = git
  }

  async currentBranch() {
    if (this.env.GITHUB_REF_NAME) return this.env.GITHUB_REF_NAME
    return (await this.git(['branch', '--show-current'])).stdout.trim()
  }

  private async assertNoUnpublishedTags(localTags: string[]) {
    const remoteTags = remoteTagNames((await this.git(['ls-remote', '--tags', 'origin'])).stdout)
    const unpublished = localTags.filter(tag => !remoteTags.has(tag))
    if (unpublished.length > 0) {
      throw new Error(`Refusing to publish local-only tags: ${unpublished.join(', ')}`)
    }
  }

  async prepare() {
    const branch = await this.currentBranch()
    if (branch !== 'main' && branch !== 'next')
      throw new Error(`Releases can only run from main or next, received ${branch || '(detached)'}`)

    const localTags = (await this.git(['tag', '--merged', 'HEAD', '--list'])).stdout
      .split('\n')
      .map(tag => tag.trim())
      .filter(Boolean)
    await this.assertNoUnpublishedTags(localTags)
  }
}