import { execFile } from 'node:child_process'
import { appendFile } from 'node:fs/promises'
import { promisify } from 'node:util'

import { rootDir } from './set-version.mts'

const execFileAsync = promisify(execFile)

export const releaseRecoveryMode = 'withdrawn-2x'
export const withdrawnRelease = { noteRef: 'semantic-release-2.0.0', version: '2.0.0' } as const

export interface GitResult {
  status: number
  stderr: string
  stdout: string
}

export type GitRunner = (args: string[], options?: { allowFailure?: boolean }) => Promise<GitResult>

async function runGit(
  args: string[],
  options: { allowFailure?: boolean } = {},
): Promise<GitResult> {
  try {
    const result = await execFileAsync('git', args, { cwd: rootDir, encoding: 'utf-8' })
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

function parseVersionTag(tag: string) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(tag)
  if (!match) return undefined
  return { major: Number(match[1]), prerelease: match[4] }
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

export function hasRecoveredRelease(branch: string, tags: string[]) {
  return tags.some(tag => {
    const version = parseVersionTag(tag)
    if (!version || version.major < 3) return false
    if (branch === 'main') return version.prerelease === undefined
    return version.prerelease === undefined || version.prerelease.startsWith('next.')
  })
}

export interface ReleasePreparation {
  ephemeralTag?: string
  shouldRun: boolean
}

interface ReleaseEnvironmentOptions {
  env?: NodeJS.ProcessEnv
  git?: GitRunner
  writeOutput?: (path: string, contents: string) => Promise<void>
}

export class ReleaseEnvironment {
  private readonly env: NodeJS.ProcessEnv
  private readonly git: GitRunner
  private readonly writeOutput: (path: string, contents: string) => Promise<void>

  constructor({
    env = process.env,
    git = runGit,
    writeOutput = async (path, contents) => appendFile(path, contents, { encoding: 'utf-8' }),
  }: ReleaseEnvironmentOptions = {}) {
    this.env = env
    this.git = git
    this.writeOutput = writeOutput
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

  private async blockForExplicitRecovery() {
    const message =
      'The withdrawn 2.x history requires an explicit recovery run before automatic releases.'
    if (this.env.GITHUB_OUTPUT) {
      await this.writeOutput(this.env.GITHUB_OUTPUT, 'has-release=false\nrecovery-required=true\n')
    }
    if (this.env.GITHUB_STEP_SUMMARY) {
      await this.writeOutput(
        this.env.GITHUB_STEP_SUMMARY,
        `## Release recovery required\n\n${message}\n`,
      )
    }
    console.log(message)
    return { shouldRun: false } satisfies ReleasePreparation
  }

  private async createEphemeralBaseline() {
    await this.git([
      'fetch',
      '--no-tags',
      'origin',
      `+refs/notes/${withdrawnRelease.noteRef}:refs/notes/${withdrawnRelease.noteRef}`,
    ])
    const notes = (await this.git(['notes', '--ref', withdrawnRelease.noteRef, 'list'])).stdout
      .trim()
      .split('\n')
      .filter(Boolean)
    if (notes.length !== 1) {
      throw new Error(
        `Expected one ${withdrawnRelease.noteRef} note, found ${notes.length.toString()}`,
      )
    }

    const [, releaseHead] = notes[0].trim().split(/\s+/)
    if (!releaseHead) throw new Error(`Unable to resolve ${withdrawnRelease.noteRef} target`)

    const ancestor = await this.git(['merge-base', '--is-ancestor', releaseHead, 'HEAD'], {
      allowFailure: true,
    })
    if (ancestor.status !== 0) {
      throw new Error(`Withdrawn release commit ${releaseHead} is not an ancestor of HEAD`)
    }

    await this.git(['tag', '--no-sign', withdrawnRelease.version, releaseHead])
    return withdrawnRelease.version
  }

  async prepare(): Promise<ReleasePreparation> {
    const branch = await this.currentBranch()
    if (branch !== 'main' && branch !== 'next') {
      throw new Error(`Releases can only run from main or next, received ${branch || '(detached)'}`)
    }

    const localTags = (await this.git(['tag', '--merged', 'HEAD', '--list'])).stdout
      .split('\n')
      .map(tag => tag.trim())
      .filter(Boolean)
    await this.assertNoUnpublishedTags(localTags)
    if (hasRecoveredRelease(branch, localTags)) return { shouldRun: true }

    if (this.env.DELTA_RELEASE_RECOVERY !== releaseRecoveryMode) {
      return this.blockForExplicitRecovery()
    }

    const ephemeralTag = await this.createEphemeralBaseline()
    return { ephemeralTag, shouldRun: true }
  }

  async cleanup(ephemeralTag?: string) {
    if (!ephemeralTag) return
    await this.git(['tag', '--delete', ephemeralTag], { allowFailure: true })
  }
}

export async function removeEphemeralReleaseTag(env: NodeJS.ProcessEnv, git: GitRunner = runGit) {
  const tag = env.DELTA_RELEASE_EPHEMERAL_TAG
  if (!tag) return
  if (tag !== withdrawnRelease.version) {
    throw new Error(`Refusing to delete unexpected ephemeral tag ${tag}`)
  }
  const result = await git(['tag', '--delete', tag], { allowFailure: true })
  if (result.status !== 0 && !result.stderr.includes('not found')) {
    throw new Error(`Unable to remove ephemeral tag ${tag}: ${result.stderr.trim()}`)
  }
}