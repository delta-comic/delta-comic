import type { Context, Plugin } from 'cordis'

export { cfg } from './config'

import { coreI18n } from './i18n'
import { tokenInit, nativeInit, tokenShare } from './share'

function core(ctx: Context) {
  ctx.i18n.register(coreI18n)
  ctx.share.register({ share: { initiative: [tokenInit, nativeInit], tokenListen: [tokenShare] } })
}

core.inject = ['i18n', 'share']
export default [core] satisfies readonly Plugin.Function[]