import pkg from '../../package.json'
import { DELTA_COMIC_PLUGIN_API_VERSION } from '../api'
import CorePlugin from '../core'
import { defineInternalPlugin } from '../kernel'

export const corePluginDefinition = defineInternalPlugin({
  canDisable: false,
  factory: CorePlugin,
  manifest: {
    apiVersion: DELTA_COMIC_PLUGIN_API_VERSION,
    author: 'Delta Comic',
    description: 'Delta Comic host capabilities',
    kind: 'preboot',
    name: { display: 'core', id: 'core' },
    require: [],
    version: { plugin: pkg.version, supportCore: '*' },
  },
})

export default corePluginDefinition