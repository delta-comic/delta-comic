import { pluginExposes } from '@/depends'
import type { PluginConfig } from '@/plugin'

import { PluginBooter } from '../utils'

class _ExposeBootPlugin extends PluginBooter {
  public override name = '自定义初始化'
  public override async call(cfg: PluginConfig, _: any, env: Record<any, any>): Promise<any> {
    if (!cfg.onBooted) return
    const expose = await cfg.onBooted({ api: env.api })
    if (expose) pluginExposes.set(Symbol.for(`expose:${cfg.name}`), expose)
  }
}
export default new _ExposeBootPlugin()