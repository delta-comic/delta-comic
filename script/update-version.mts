import fs from 'node:fs'

import semantic from 'semantic-release'

import config from '../.releaserc.mjs'
import pkg from '../package.json' with { type: 'json' }

import { setVersion } from './set-version.mts'
const file = fs.createWriteStream('./log.log')

const result = await semantic(config, {
  env: { ...process.env, IS_DUR_RUN: true },
  stdout: file as any,
  stderr: file as any
})

if (result) {
  await setVersion(result.nextRelease.version)
  console.log(pkg.version)
  process.exit(0)
}
process.exit(0)