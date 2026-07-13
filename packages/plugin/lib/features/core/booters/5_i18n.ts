import { pluginI18n, pluginMessageKey } from '@/i18n'
import type { PluginConfig } from '@/plugin'

import { PluginBooter } from '../../../driver/extensionTypes'

class PluginI18nBooter extends PluginBooter {
  public override name = pluginMessageKey('plugin.runtime.steps.language.title')

  public override async call(cfg: PluginConfig): Promise<void> {
    if (cfg.i18n) pluginI18n.register(cfg.name, cfg.i18n)
  }
}

export default new PluginI18nBooter()