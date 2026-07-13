import { pluginMessageKey } from '@/i18n'
import type { PluginConfig } from '@/plugin'
import { runOtherProgress } from '@/plugin/otherProgress'

import { PluginBooter, type PluginBooterSetMeta } from '../../../driver/extensionTypes'

class _TestPluginResource extends PluginBooter {
  public override name = pluginMessageKey('plugin.runtime.steps.other.title')
  public override async call(cfg: PluginConfig, setMeta: PluginBooterSetMeta): Promise<any> {
    if (!cfg.otherProgress?.length) return

    await runOtherProgress(cfg.otherProgress, { setMeta })
  }
}
export default new _TestPluginResource()