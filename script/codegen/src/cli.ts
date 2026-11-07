#!/usr/bin/env node

import { resolve } from 'node:path'

import { Command } from 'commander'

import packageJson from '../package.json' with { type: 'json' }

import { checkCodegen } from './check'
import { codegenDefinitions } from './check'
import { generateCodegen } from './run'

type Target = 'client' | 'all'

const isTarget = (value: string): value is Target => value === 'client' || value === 'all'

const createProgram = () => {
  const program = new Command()
    .name('dcg')
    .description('Delta Comic 数据库代码生成 CLI')
    .version(packageJson.version)
    .option('--cwd <path>', '项目目录', process.cwd())

  program
    .command('generate <target>')
    .description('生成数据库 SQL、Kysely 类型和运行时 schema')
    .action(async (target: string) => {
      if (!isTarget(target)) throw new Error(`不支持的生成目标: ${target}`)
      const root = resolve(program.opts<{ cwd: string }>().cwd)
      const definitions =
        target === 'all'
          ? codegenDefinitions
          : codegenDefinitions.filter(([file]) => file.includes('client.table'))
      for (const [tableFile, outputDir] of definitions)
        await generateCodegen(root, tableFile, outputDir)
    })

  program
    .command('check')
    .description('检查生成文件是否与表定义一致')
    .action(async () => {
      await checkCodegen(resolve(program.opts<{ cwd: string }>().cwd))
    })

  return program
}

export async function runCli(argv = process.argv): Promise<number> {
  try {
    await createProgram().parseAsync(argv)
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}

process.exitCode = await runCli()