import { defineDeltaComicPlugin } from '../api'

export { cfg } from './config'

import { pluginName } from './env'
import { tokenInit, nativeInit, tokenShare } from './share'

export default defineDeltaComicPlugin(() => ({
  name: pluginName,
  model: { social: { share: { initiative: [tokenInit, nativeInit], tokenListen: [tokenShare] } } },
}))