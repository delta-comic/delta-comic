import type { PluginManifest } from '@delta-comic/shared-plugin-manifest'

import pkg from '../../package.json'
import core from '../core'

export const manifest: PluginManifest = {
  protocolVersion: 2,
  id: 'core',
  name: 'core',
  client: { entry: 'core' },
  resources: [],
  author: 'Delta Comic',
  description: 'Delta Comic host services',
  version: pkg.version,
}

export default core