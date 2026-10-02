import { defineDeltaComicPlugin } from '../api'

export { cfg } from './config'

import { pluginName } from './env'
import { coreI18n } from './i18n'
import { tokenInit, nativeInit, tokenShare } from './share'

export default defineDeltaComicPlugin(() => ({
  name: pluginName,
  i18n: coreI18n,
  model: { social: { share: { initiative: [tokenInit, nativeInit], tokenListen: [tokenShare] } } },
}))