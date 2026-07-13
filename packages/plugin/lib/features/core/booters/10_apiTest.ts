import { pluginI18n, pluginMessageKey } from '@/i18n'
import type { PluginConfig } from '@/plugin'

import { PluginBooter, type PluginBooterSetMeta } from '../../../driver/extensionTypes'

import { testApi } from './utils'

export type _TestPluginApiResult = Record<string, string | false | undefined>

class _TestPluginApi extends PluginBooter {
  public override name = pluginMessageKey('plugin.runtime.steps.apiTest.title')
  public override async call(
    cfg: PluginConfig,
    setMeta: PluginBooterSetMeta,
    env: Record<any, any>,
  ): Promise<any> {
    if (!cfg.api) return
    setMeta(pluginMessageKey('plugin.runtime.steps.tests.starting'))

    const namespaces = Object.keys(cfg.api)
    const results = await Promise.all(namespaces.map(namespace => testApi(cfg.api![namespace])))
    const displayResult = new Array<[namespace: string, time: number | false]>()
    const api: _TestPluginApiResult = {}
    namespaces.forEach((namespace, i) => {
      api[namespace] = results[i][0]
      displayResult.push([namespace, results[i][1]])
    })

    env.api = api

    if (Object.values(api).some(v => v == false)) {
      setMeta(pluginMessageKey('plugin.runtime.steps.tests.unreachable'))
      throw new Error('can not connect to server')
    }
    setMeta(
      pluginI18n.translate('plugin.runtime.steps.tests.complete', {
        results: displayResult.map(ent => `${ent[0]} -> ${ent[1]} ms`).join('\n'),
      }),
    )
  }
}
export default new _TestPluginApi()