import { uni } from '@delta-comic/model'

import { pluginI18n, pluginMessageKey } from '@/i18n'
import type { PluginConfig } from '@/plugin'

import { PluginBooter, type PluginBooterSetMeta } from '../../../driver/extensionTypes'

import { testResourceApi } from './utils'

class _TestPluginResource extends PluginBooter {
  public override name = pluginMessageKey('plugin.runtime.steps.resourceTest.title')
  public override async call(cfg: PluginConfig, setMeta: PluginBooterSetMeta): Promise<any> {
    if (!cfg.resource?.types?.length) return
    setMeta(pluginMessageKey('plugin.runtime.steps.tests.starting'))

    const types = cfg.resource.types.map(v => ({ type: v.type, val: v }))
    const results = await Promise.all(types.map(type => testResourceApi(type.val)))
    const displayResult = new Array<[type: (typeof types)[number], time: number | false]>()
    types.forEach((type, i) => {
      if (results[i][1])
        uni.resource.Resource.precedenceFork.set([cfg.name, type.type], results[i][0])
      displayResult.push([type, results[i][1]])
    })
    if (results.some(v => v[1] == false)) {
      setMeta(pluginMessageKey('plugin.runtime.steps.tests.unreachable'))
      throw new Error('[plugin test] can not connect to server')
    }
    setMeta(
      pluginI18n.translate('plugin.runtime.steps.tests.complete', {
        results: displayResult.map(ent => `${ent[0].type} -> ${ent[1]} ms`).join('\n'),
      }),
    )
  }
}
export default new _TestPluginResource()