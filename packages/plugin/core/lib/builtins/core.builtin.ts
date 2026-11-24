import type { PluginManifest } from '@delta-comic/manifest'

import pkg from '../../package.json'
import core from '../core'

export const manifest: PluginManifest = {
  id: 'core',
  name: 'core',
  entry: 'core',
  resources: [],
  author: 'Delta Comic',
  description: 'Delta Comic host services',
  version: pkg.version,
}

export default core