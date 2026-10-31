import { execFile } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { rootDir } from './set-version.mts'

const execFileAsync = promisify(execFile)

export type ReleaseBranchAction = 'develop' | 'preview' | 'stable'

export interface GitResult {
  status: number
  stdout: string
}

export type GitRunner = (args: string[], options?: { allowFailure?: boolean }) => Promise<GitResult>

export interface ReleaseBranchOptions {
  action: ReleaseBranchAction
  dryRun: boolean
  help: boolean
}

export const releaseBranchUsage = `Usage: node ./script/release-branches.mts <action> [--dry-run]

Actions:
  develop  Switch to develop, creating it or merging stable main back into it
  preview  Merge origin/develop into next and push next to trigger a preview release
  stable   Merge origin/next into main and push main to trigger a stable release

Options:
  --dry-run  Print the branch operation without executing git commands
  --help     Show this help`

const promotionBranches = {
  preview: { source: 'develop', target: 'next' },
  stable: { source: 'next', target: 'main' },
} as const

async function runGit(
  args: string[],
  options: { allowFailure?: boolean } = {},
): Promise<GitResult> {
  try {
    const result = await execFileAsync('git', args, { cwd: rootDir, encoding: 'utf-8' })
    return { status: 0, stdout: result.stdout }
  } catch (error) {
    const status = typeof error === 'object' && error && 'code' in error ? Number(error.code) : 1
    if (options.allowFailure) return { status, stdout: '' }
    throw error
  }
}

export function parseReleaseBranchArgs(args: string[]): ReleaseBranchOptions {
  if (args.includes('--help') || args.includes('-h')) {
    return { action: 'develop', dryRun: false, help: true }
  }

  const positionalArguments = args.filter(argument => !argument.startsWith('-'))
  const [action] = positionalArguments
  if (
    positionalArguments.length !== 1 ||
    (action !== 'develop' && action !== 'preview' && action !== 'stable')
  ) {
    throw new Error(
      `Unknown or missing release branch action: ${positionalArguments.join(', ') || '(missing)'}`,
    )
  }

  const unknownOptions = args.filter(
    argument => argument.startsWith('-') && argument !== '--dry-run',
  )
  if (unknownOptions.length > 0) throw new Error(`Unknown option: ${unknownOptions[0]}`)

  return { action, dryRun: args.includes('--dry-run'), help: false }
}

export function describeReleaseBranchAction(action: ReleaseBranchAction) {
  if (action === 'develop') {
    return `Dry run: develop
  1. Require a clean worktree and fetch origin.
  2. Create develop from origin/main when it does not exist.
  3. Otherwise synchronize develop, merge origin/main back into it, and push develop.
  No git command was executed.`
  }

  const { source, target } = promotionBranches[action]
  return `Dry run: ${action} (${source} -> ${target})
  1. Require a clean worktree and fetch origin.
  2. Switch to ${source} and require it to exactly match origin/${source}.
  3. Switch to ${target}, synchronize it with origin/${target}, then merge ${source}.
  4. Push ${target} to trigger CI and switch back to ${source}.
  No git command was executed.`
}

export class ReleaseBranchManager {
  private readonly git: GitRunner

  constructor(git: GitRunner = runGit) {
    this.git = git
  }

  private async branchExists(ref: string) {
    const result = await this.git(['show-ref', '--verify', '--quiet', ref], { allowFailure: true })
    return result.status === 0
  }

  private async requireCleanWorktree() {
    const status = await this.git(['status', '--porcelain'])
    if (status.stdout.trim()) {
      throw new Error('The worktree must be clean before switching release branches')
    }
  }

  private async requireRemoteBranch(branch: string) {
    if (!(await this.branchExists(`refs/remotes/origin/${branch}`))) {
      throw new Error(`Remote branch origin/${branch} does not exist`)
    }
  }

  private async requireExactRemote(branch: string) {
    const [local, remote] = await Promise.all([
      this.git(['rev-parse', `refs/heads/${branch}`]),
      this.git(['rev-parse', `refs/remotes/origin/${branch}`]),
    ])
    if (local.stdout.trim() !== remote.stdout.trim()) {
      throw new Error(
        `Local ${branch} contains commits that are not synchronized with origin/${branch}`,
      )
    }
  }

  private async switchToRemoteBranch(branch: string) {
    await this.requireRemoteBranch(branch)
    const hasLocalBranch = await this.branchExists(`refs/heads/${branch}`)
    if (hasLocalBranch) {
      await this.git(['switch', branch])
      await this.git(['merge', '--ff-only', `refs/remotes/origin/${branch}`])
    } else {
      await this.git(['switch', '--track', '-c', branch, `origin/${branch}`])
    }
    await this.requireExactRemote(branch)
  }

  async prepareDevelop() {
    await this.requireCleanWorktree()
    await this.git(['fetch', '--prune', 'origin'])

    if (await this.branchExists('refs/remotes/origin/develop')) {
      await this.switchToRemoteBranch('develop')
      await this.requireRemoteBranch('main')
      await this.git(['merge', '--no-ff', '--no-edit', 'refs/remotes/origin/main'])
      await this.git(['push', 'origin', 'develop'])
      return
    }

    await this.requireRemoteBranch('main')
    if (await this.branchExists('refs/heads/develop')) {
      throw new Error(
        'Local develop exists without origin/develop; inspect it before creating the remote branch',
      )
    }

    await this.git(['switch', '-c', 'develop', 'refs/remotes/origin/main'])
    await this.git(['push', '--set-upstream', 'origin', 'develop'])
  }

  async promote(action: 'preview' | 'stable') {
    const { source, target } = promotionBranches[action]
    await this.requireCleanWorktree()
    await this.git(['fetch', '--prune', 'origin'])
    await this.switchToRemoteBranch(source)

    const hasRemoteTarget = await this.branchExists(`refs/remotes/origin/${target}`)
    if (!hasRemoteTarget) {
      if (action !== 'preview') throw new Error(`Remote branch origin/${target} does not exist`)
      if (await this.branchExists(`refs/heads/${target}`)) {
        throw new Error(
          `Local ${target} exists without origin/${target}; inspect it before creating the remote branch`,
        )
      }
      await this.git(['switch', '-c', target, source])
      await this.git(['push', '--set-upstream', 'origin', target])
      await this.git(['switch', source])
      return
    }

    await this.switchToRemoteBranch(target)
    await this.git(['merge', '--no-ff', '--no-edit', source])
    await this.git(['push', 'origin', target])
    await this.git(['switch', source])
  }

  async execute(action: ReleaseBranchAction) {
    if (action === 'develop') await this.prepareDevelop()
    else await this.promote(action)
  }
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isCli) {
  try {
    const options = parseReleaseBranchArgs(process.argv.slice(2))
    if (options.help) console.log(releaseBranchUsage)
    else if (options.dryRun) console.log(describeReleaseBranchAction(options.action))
    else {
      await new ReleaseBranchManager().execute(options.action)
      console.log(`Release branch action completed: ${options.action}`)
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    console.error(`\n${releaseBranchUsage}`)
    process.exitCode = 1
  }
}