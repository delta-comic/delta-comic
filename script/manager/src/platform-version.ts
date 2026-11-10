import { parse } from 'semver'

export function toWindowsMsiVersion(
  /**
   * @example 3.0.0
   * @example 3.0.0-next.25
   */
  version: string,
): string {
  const MSI_MAX = { major: 255, minor: 255, build: 65535 } as const

  const BUILD_FACTOR = 100
  const RELEASE_SLOT = 99

  const parsed = parse(version)

  if (!parsed) {
    throw new Error(`Invalid SemVer version: ${version}`)
  }

  const { major, minor, patch, prerelease } = parsed

  if (major > MSI_MAX.major || minor > MSI_MAX.minor) {
    throw new RangeError(`MSI major/minor version exceeds limit: ${version}`)
  }

  // Reserve 100 build numbers for each SemVer patch.
  if (patch > 654) {
    throw new RangeError(`MSI patch version exceeds supported range: ${version}`)
  }

  let slot = RELEASE_SLOT

  if (prerelease.length > 0) {
    const [channel, sequence, ...rest] = prerelease

    // Currently supports next.N prerelease versions.
    if (
      channel !== 'next' ||
      typeof sequence !== 'number' ||
      rest.length !== 0 ||
      sequence < 0 ||
      sequence >= RELEASE_SLOT
    ) {
      throw new Error(`Unsupported prerelease version: ${version}`)
    }

    slot = sequence
  }

  const build = patch * BUILD_FACTOR + slot

  if (build > MSI_MAX.build) {
    throw new RangeError(`MSI build version exceeds limit: ${version}`)
  }

  return `${major}.${minor}.${build}`
}

export function toLinuxRmpVersion(
  /**
   * @example 3.0.0
   * @example 3.0.0-next.25
   */
  version: string,
): string {
  return version.replaceAll('-', '+')
}