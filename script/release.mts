import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

import { ReleaseEnvironment, type ReleasePreparation } from './release-environment.mts'
import { rootDir } from './set-version.mts'

export type SemanticReleaseRunner = (args: string[], env: NodeJS.ProcessEnv) => Promise<void>

interface PreparedReleaseEnvironment {
  cleanup(ephemeralTag?: string): Promise<void>
  prepare(): Promise<ReleasePreparation>
}

async function runSemanticRelease(args: string[], env: NodeJS.ProcessEnv) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('vp', ['exec', 'semantic-release', ...args], {
      cwd: rootDir,
      env,
      stdio: 'inherit',
    })
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
  const preparation = await environment.prepare()

  if (!preparation.shouldRun) return false

  try {
    await semanticRelease(args, {
      ...env,
      ...(preparation.ephemeralTag
        ? { DELTA_RELEASE_EPHEMERAL_TAG: preparation.ephemeralTag }
        : {}),
    })
  } finally {
    await environment.cleanup(preparation.ephemeralTag)
  }
  return true
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isCli) {
  await executeRelease(process.argv.slice(2))
}