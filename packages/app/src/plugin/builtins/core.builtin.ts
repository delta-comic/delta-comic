import type { PluginManifest } from '@delta-comic/platform/manifest'

import pkg from '../../../package.json'
import core from '../core'

export const manifest: PluginManifest = {
  id: 'core',
  name: 'core',
  formatVersion: 2,
  package: 'core',
  script: 'core',
  exports: [],
  externals: [],
  pluginPeers: {},
  supportCoreVersion: '*',
  resources: [],
  author: 'Delta Comic',
  description: 'Delta Comic host services',
  version: pkg.version,
}

export default core