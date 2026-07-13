import { pluginMessageKey } from '../../i18n'
import { defineInnerPlugin } from '../../plugin'

import { coreConfig } from './config'

export { coreConfig } from './config'

export default defineInnerPlugin({
  meta: {
    kind: 'preboot',
    author: 'Delta Comic',
    description: pluginMessageKey('plugin.core.description'),
    require: [],
    name: { display: pluginMessageKey('settings.core.title'), id: 'core' },
    version: { plugin: '2.3.0', supportCore: '*' },
  },
  enabledByDefault: true,
  config: () => ({ name: 'core', config: [coreConfig] }),
})