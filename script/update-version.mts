import { Bumper } from 'conventional-recommended-bump'
import semver from 'semver'

import pkg from '../package.json' with { type: 'json' }
//@ts-ignore .mts was exist
import { setVersion } from './set-version.mts'

const recommend = await new Bumper().loadPreset('angular').bump()

if (!('releaseType' in recommend)) {
  process.exit(0)
}

const next = semver.inc(pkg.version, recommend.releaseType)!

await setVersion(next)

console.log(pkg.version)
process.exit(0)