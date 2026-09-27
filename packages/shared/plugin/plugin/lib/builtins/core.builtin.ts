import type { PluginConfig } from '@delta-comic/plugin-api'
import { defineInternalPlugin } from '@delta-comic/plugin-kernel'

import pkg from '../../package.json'
import CorePlugin from '../core'

export const corePluginDefinition = defineInternalPlugin({
  canDisable: false,
  factory: environment =>
    CorePlugin({ platform: environment.platform === 'tauri' ? 'tauri' : 'web' }) as PluginConfig,
  manifest: {
    protocolVersion: 1,
    id: 'core',
    name: 'core',
    entry: 'core',
    entryType: 'plugin',
    resources: [],
    author: 'Delta Comic',
    description: 'Delta Comic host capabilities',
    version: pkg.version,
  },
})

export default corePluginDefinition