#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { Command, InvalidArgumentError } from 'commander'

import packageJson from '../package.json' with { type: 'json' }

import { findProjectRoot, loadReleaseCliConfig } from './config.mts'
import { describeReleaseBranchAction, ReleaseBranchManager } from './release-branches.mts'
import { ReleaseEnvironment } from './release-environment.mts'
import { executeRelease, runSemanticRelease } from './release.mts'
import { assertVersion, VersionSynchronizer } from './set-version.mts'
import { toWindowsMsiVersion, writeWindowsMsiConfig } from './windows-msi-version.mts'

function projectRoot(program: Command) {
  const cwd = program.opts<{ cwd: string }>().cwd
  return findProjectRoot(cwd || process.cwd())
}

function dryRun(program: Command, local = false) {
  return Boolean(program.opts<{ dryRun?: boolean }>().dryRun || local)
}

async function projectConfig(program: Command, root = projectRoot(program)) {
  const configPath = program.opts<{ config?: string }>().config
  return loadReleaseCliConfig(root, configPath)
}

function parseVersion(value: string) {
  try {
    assertVersion(value)
    return value
  } catch (error) {
    throw new InvalidArgumentError(error instanceof Error ? error.message : String(error))
  }
}

async function setCliPackageVersion(root: string, version: string) {
  assertVersion(version)
  const path = join(root, 'script/manager/package.json')
  const raw = await readFile(path, 'utf8')
  const manifest = JSON.parse(raw) as { version?: string }
  if (!manifest.version) throw new Error(`Unable to find version field in ${path}`)
  const next = raw.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`)
  await writeFile(path, next, 'utf8')
  console.log(`Updated ${path} to ${version}`)
}

function createProgram() {
  const program = new Command()
    .name('dr')
    .description('Delta Comic semantic-release 控制 CLI')
    .version(packageJson.version)
    .option('--cwd <path>', '项目目录', process.cwd())
    .option('--config <path>', '项目配置文件路径')
    .option('--dry-run', '只输出计划，不写入或发布')

  const branch = program.command('branch').description('管理发布分支')
  branch
    .command('prepare <branch>')
    .description('准备 develop 分支')
    .option('--dry-run', '输出计划')
    .action(async (branchName: string, options: { dryRun?: boolean }) => {
      if (branchName !== 'develop') throw new Error('branch prepare 只支持 develop')
      if (dryRun(program, options.dryRun)) console.log(describeReleaseBranchAction('develop'))
      else {
        await new ReleaseBranchManager(undefined, projectRoot(program)).execute('develop')
        console.log('Release branch action completed: develop')
      }
    })
  branch
    .command('promote <channel>')
    .description('将 develop 晋级到 next，或将 next 晋级到 main')
    .option('--dry-run', '输出计划')
    .action(async (channel: string, options: { dryRun?: boolean }) => {
      if (channel !== 'preview' && channel !== 'stable') {
        throw new Error('branch promote 只支持 preview 或 stable')
      }
      if (dryRun(program, options.dryRun)) console.log(describeReleaseBranchAction(channel))
      else {
        await new ReleaseBranchManager(undefined, projectRoot(program)).execute(channel)
        console.log(`Release branch action completed: ${channel}`)
      }
    })

  const release = program.command('release').description('执行 semantic-release')
  release
    .command('plan')
    .description('计算发布计划并写出 CI 输出')
    .option('--recover-withdrawn-2x', '恢复已撤回的 2.x 发布序列')
    .option('--dry-run', '只计算发布计划')
    .action(async (options: { recoverWithdrawn2x?: boolean; dryRun?: boolean }) => {
      const cwd = projectRoot(program)
      await projectConfig(program, cwd)
      const env = { ...process.env }
      if (options.recoverWithdrawn2x) env.DELTA_RELEASE_RECOVERY = 'withdrawn-2x'
      await executeRelease(
        ['--dry-run'],
        env,
        new ReleaseEnvironment({ cwd, env }),
        (args, nextEnv) => runSemanticRelease(args, nextEnv, cwd),
      )
    })
  release
    .command('run')
    .description('执行实际发布')
    .option('--recover-withdrawn-2x', '恢复已撤回的 2.x 发布序列')
    .option('--dry-run', '只计算发布计划')
    .action(async (options: { recoverWithdrawn2x?: boolean; dryRun?: boolean }) => {
      const cwd = projectRoot(program)
      await projectConfig(program, cwd)
      const env = { ...process.env }
      if (options.recoverWithdrawn2x) env.DELTA_RELEASE_RECOVERY = 'withdrawn-2x'
      await executeRelease(
        dryRun(program, options.dryRun) ? ['--dry-run'] : [],
        env,
        new ReleaseEnvironment({ cwd, env }),
        (args, nextEnv) => runSemanticRelease(args, nextEnv, cwd),
      )
    })

  const version = program.command('version').description('同步项目版本')
  version
    .command('sync <version>')
    .description('同步 JSON、Cargo 和 Cargo.lock 版本')
    .option('--dry-run', '只显示目标版本')
    .action(async (value: string, options: { dryRun?: boolean }) => {
      const root = projectRoot(program)
      const next = parseVersion(value)
      const config = await projectConfig(program, root)
      const synchronizer = new VersionSynchronizer(root, config)
      const changes = await synchronizer.plan(next)
      if (dryRun(program, options.dryRun)) {
        console.log(`Version synchronization plan: ${next}`)
        console.log(changes.map(path => `  ${path} -> ${next}`).join('\n'))
      } else await synchronizer.setVersion(next)
    })
  version
    .command('msi <version>')
    .description('生成 Windows MSI 版本配置')
    .option('--dry-run', '只显示 MSI 版本')
    .action(async (value: string, options: { dryRun?: boolean }) => {
      const next = parseVersion(value)
      const root = projectRoot(program)
      const config = await projectConfig(program, root)
      if (dryRun(program, options.dryRun))
        console.log(`Windows MSI version: ${toWindowsMsiVersion(next)}`)
      else console.log(`Updated ${await writeWindowsMsiConfig(next, root, config.msiConfigPath)}`)
    })

  const packageCommand = program.command('package').description('管理 CLI 包自身版本')
  packageCommand
    .command('version')
    .description('管理 @delta-comic/release-cli 版本')
    .command('set <version>')
    .description('设置 @delta-comic/release-cli 版本')
    .option('--dry-run', '只显示目标版本')
    .action(async (value: string, options: { dryRun?: boolean }) => {
      const root = projectRoot(program)
      const version = parseVersion(value)
      if (dryRun(program, options.dryRun)) console.log(`CLI package version: ${version}`)
      else await setCliPackageVersion(root, version)
    })

  return program
}

export async function runCli(argv = process.argv) {
  const program = createProgram()
  try {
    await program.parseAsync(argv)
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}

process.exitCode = await runCli()