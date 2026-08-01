import { defineDeltaComicPlugin } from '../api'

import { cfg } from './config'
export { cfg } from './config'

import { pluginName } from './env'
import { tokenInit, nativeInit, tokenShare } from './share'

export default defineDeltaComicPlugin(() => ({
  config: cfg,
  name: pluginName,
  model: { social: { share: { initiative: [tokenInit, nativeInit], tokenListen: [tokenShare] } } },
}))