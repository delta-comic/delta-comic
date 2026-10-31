import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { ReleaseCliConfig } from './config.mts'
import { assertVersion, rootDir } from './set-version.mts'

const stableBuild = 65_535
const maximumPrereleaseBuild = stableBuild - 1
const msiCoreLimits = [255, 255, 65_535] as const

export function toWindowsMsiVersion(version: string) {
  assertVersion(version)

  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([^+]+))?/.exec(version)
  if (!match) throw new Error(`Unable to parse semantic version: ${version}`)

  const core = match.slice(1, 4).map(Number)
  core.forEach((part, index) => {
    const limit = msiCoreLimits[index]
    if (limit !== undefined && part > limit) {
      throw new Error(`MSI version component ${part} exceeds its limit of ${limit}`)
    }
  })

  const prerelease = match[4]
  let build = stableBuild
  if (prerelease) {
    const counter = prerelease.split('.').at(-1)
    if (!counter || !/^(0|[1-9]\d*)$/.test(counter)) {
      throw new Error(`MSI prerelease version requires a numeric final identifier: ${version}`)
    }

    build = Number(counter)
    if (build > maximumPrereleaseBuild) {
      throw new Error(
        `MSI prerelease build ${build} exceeds the maximum of ${maximumPrereleaseBuild}`,
      )
    }
  }

  return `${core.join('.')}.${build}`
}

export async function writeWindowsMsiConfig(
  version: string,
  cwd = rootDir,
  configuredPath?: ReleaseCliConfig['msiConfigPath'],
) {
  if (!configuredPath) {
    throw new Error('msiConfigPath is required in .release-cli.config.ts')
  }
  const target = join(cwd, configuredPath)
  await mkdir(join(target, '..'), { recursive: true })
  await writeFile(
    target,
    `${JSON.stringify(
      { bundle: { windows: { wix: { version: toWindowsMsiVersion(version) } } } },
      null,
      2,
    )}\n`,
  )
  return target
}