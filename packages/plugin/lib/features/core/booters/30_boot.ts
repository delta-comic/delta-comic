import { declareDepType, provide } from '@/depends'
import { pluginMessageKey } from '@/i18n'
import type { PluginConfig } from '@/plugin'

import { PluginBooter } from '../../../driver/extensionTypes'

class _ExposeBootPlugin extends PluginBooter {
  public override name = pluginMessageKey('plugin.runtime.steps.customBoot.title')
  public override async call(cfg: PluginConfig, _: any, env: Record<any, any>): Promise<any> {
    if (!cfg.onBooted) return
    const expose = await cfg.onBooted({ api: env.api })
    if (expose) provide(declareDepType(cfg.name), expose)
  }
}
export default new _ExposeBootPlugin()