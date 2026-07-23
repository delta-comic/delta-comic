import { spawn } from 'node:child_process'
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { removeEphemeralReleaseTag } from './release-environment.mts'
import { prereleaseWarning } from './release-notes.mts'
import {
  assertWorkspaceVersion,
  type PublishableWorkspacePackage,
  ReleaseWorkspace,
} from './release-workspace.mts'
import { assertVersion, rootDir, setVersion, versionAssetPaths } from './set-version.mts'

interface ReleaseContext {
  branch?: { name: string }
  env: NodeJS.ProcessEnv
  nextRelease: { channel?: string | null; notes?: string; version: string }
}

export type CommandRunner = (command: string, args: string[]) => Promise<void>
export type ReleaseCommitter = (
  version: string,
  notes: string | undefined,
  branch: string,
) => Promise<void>

async function runCommand(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd: rootDir, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', status => {
      if (status === 0) resolve()
      else reject(new Error(`Command failed (${status ?? 1}): ${command} ${args.join(' ')}`))
    })
  })
}

async function runCommandStatus(command: string, args: string[]) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, { cwd: rootDir, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', status => resolve(status ?? 1))
  })
}

export async function removePendingChangelogRelease(version: string) {
  const path = join(rootDir, 'CHANGELOG.md')
  const changelog = await readFile(path, 'utf-8')
  const rootHeading = changelog.search(/^# delta-comic\s*$/m)
  if (rootHeading <= 0) return

  const pending = changelog.slice(0, rootHeading)
  if (!pending.includes(`## [${version}]`)) return
  await writeFile(path, changelog.slice(rootHeading), 'utf-8')
}

async function commitRelease(version: string, notes: string | undefined, branch: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch)) {
    throw new Error(`Invalid release branch: ${branch}`)
  }

  await runCommand('git', ['add', '--update', '--', 'CHANGELOG.md', ...versionAssetPaths])
  const diffStatus = await runCommandStatus('git', ['diff', '--cached', '--quiet'])
  if (diffStatus === 0) return
  if (diffStatus !== 1) throw new Error(`Unable to inspect staged release changes (${diffStatus})`)

  const commitArgs = ['commit', '-m', `chore(release): ${version} [skip ci]`]
  if (notes) commitArgs.push('-m', notes)
  await runCommand('git', commitArgs)
  await runCommand('git', ['push', 'origin', `HEAD:${branch}`])
}

interface ReleasePluginDependencies {
  cleanPendingRelease?: (version: string) => Promise<void>
  commitPreparedRelease?: ReleaseCommitter
  resolvePublishablePackages?: () => Promise<PublishableWorkspacePackage[]>
  removeEphemeralTag?: (env: NodeJS.ProcessEnv) => Promise<void>
  publishCommand?: CommandRunner
  synchronizeVersion?: (version: string) => Promise<void>
  writeOutput?: (path: string, contents: string) => Promise<void>
}

export function resolveDistTag(channel?: string | null) {
  const distTag = channel || 'latest'
  if (!/^[a-z][a-z0-9._-]*$/i.test(distTag)) {
    throw new Error(`Invalid npm dist-tag: ${distTag}`)
  }
  return distTag
}

export function createReleasePlugin({
  cleanPendingRelease = removePendingChangelogRelease,
  commitPreparedRelease = commitRelease,
  resolvePublishablePackages = () => new ReleaseWorkspace().publishablePackages(),
  removeEphemeralTag = removeEphemeralReleaseTag,
  publishCommand = runCommand,
  synchronizeVersion = setVersion,
  writeOutput = async (path, contents) => appendFile(path, contents, { encoding: 'utf-8' }),
}: ReleasePluginDependencies = {}) {
  return {
    async verifyConditions(_pluginConfig: unknown, { env }: ReleaseContext) {
      if (!env.GITHUB_TOKEN) {
        throw new Error('GITHUB_TOKEN is required to publish workspace packages')
      }
      await resolvePublishablePackages()
    },

    async verifyRelease(_pluginConfig: unknown, { env, nextRelease }: ReleaseContext) {
      assertVersion(nextRelease.version)
      const channel = resolveDistTag(nextRelease.channel)
      if (env.GITHUB_OUTPUT) {
        await writeOutput(
          env.GITHUB_OUTPUT,
          `has-release=true\nversion=${nextRelease.version}\nchannel=${channel}\n`,
        )
      }
    },

    async prepare(_pluginConfig: unknown, { env, nextRelease }: ReleaseContext) {
      await removeEphemeralTag(env)
      await cleanPendingRelease(nextRelease.version)
      await synchronizeVersion(nextRelease.version)
    },

    async generateNotes(_pluginConfig: unknown, { nextRelease }: ReleaseContext) {
      return nextRelease.channel ? prereleaseWarning : ''
    },

    async publish(_pluginConfig: unknown, { nextRelease }: ReleaseContext) {
      const distTag = resolveDistTag(nextRelease.channel)
      const packages = await resolvePublishablePackages()
      assertWorkspaceVersion(packages, nextRelease.version)
      for (const pkg of packages) {
        await publishCommand('vp', ['run', '--filter', pkg.name, '--fail-if-no-match', 'build'])
      }
      await publishCommand('vp', [
        'pm',
        'publish',
        '-r',
        '--no-git-checks',
        '--provenance',
        '--tag',
        distTag,
      ])
    },

    async success(_pluginConfig: unknown, { branch, nextRelease }: ReleaseContext) {
      if (!branch) throw new Error('semantic-release did not provide the release branch')
      await commitPreparedRelease(nextRelease.version, nextRelease.notes, branch.name)
    },
  }
}

const plugin = createReleasePlugin()
export const { generateNotes, prepare, publish, success, verifyConditions, verifyRelease } = plugin