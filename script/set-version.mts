import sr from 'semantic-release'

import cfg from '../release.config.mjs'

const result = await sr({ ...cfg, dryRun: true })

if (result) {
  console.log(result.nextRelease.version)
} else {
  throw new Error('fail to run semantic-release')
}