import { defineDeltaComicPlugin } from '../export'
import { useConfig } from '../module/config/store'

import { cfg } from './config'
export { cfg } from './config'

import { pluginName } from './env'
import { tokenInit, nativeInit, tokenShare } from './share'

export default defineDeltaComicPlugin(() => ({
  name: pluginName,
  i18nName: pluginName,
  hooks: {
    onPreboot() {
      const cs = useConfig()
      cs.$register(cfg)
    },
  },
  model: { social: { share: { initiative: [tokenInit, nativeInit], tokenListen: [tokenShare] } } },
}))