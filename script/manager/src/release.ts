import { spawn } from 'node:child_process'

import { ReleaseEnvironment } from './release-environment'
import { rootDir } from './set-version'

export type SemanticReleaseRunner = (args: string[], env: NodeJS.ProcessEnv) => Promise<void>

interface PreparedReleaseEnvironment {
  prepare(): Promise<void>
}

export async function runSemanticRelease(args: string[], env: NodeJS.ProcessEnv, cwd = rootDir) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('vp', ['exec', 'semantic-release', ...args], { cwd, env, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', status => {
      if (status === 0) resolve()
      else reject(new Error(`semantic-release failed with status ${String(status ?? 1)}`))
    })
  })
}

export async function executeRelease(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
  environment: PreparedReleaseEnvironment = new ReleaseEnvironment({ env }),
  semanticRelease: SemanticReleaseRunner = runSemanticRelease,
) {
  await environment.prepare()
  await semanticRelease(args, env)
  return true
}