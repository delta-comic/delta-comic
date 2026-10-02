import { defineInternalPlugin, type InternalPluginDefinition } from '@delta-comic/plugin-kernel'

import pkg from '../../package.json'
import type { DCPluginConfig } from '../api'
import CorePlugin from '../core'

export const corePluginDefinition: InternalPluginDefinition<DCPluginConfig> = defineInternalPlugin({
  canDisable: false,
  factory: environment =>
    CorePlugin({ platform: environment.platform === 'tauri' ? 'tauri' : 'web' }),
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