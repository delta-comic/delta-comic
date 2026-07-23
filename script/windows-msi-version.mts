import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

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

export async function writeWindowsMsiConfig(version: string, cwd = rootDir) {
  const target = join(cwd, 'packages/app/src-tauri/tauri.windows.conf.json')
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

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isCli) {
  const version = process.argv[2]
  if (!version) throw new Error('Usage: node ./script/windows-msi-version.mts <version>')
  await writeWindowsMsiConfig(version)
}