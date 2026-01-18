import type { PluginConfig } from "delta-comic-core"
import { PluginBooter, type PluginBooterSetMeta } from "../utils"
import { testApi } from "./utils"

export type _TestPluginApiResult = Record<string, string | false | undefined>

class _TestPluginApi extends PluginBooter {
  public override name = '接口测试'
  public override async call(cfg: PluginConfig, setMeta: PluginBooterSetMeta, env: Record<any, any>): Promise<any> {
    if (!cfg.api) return
    setMeta('开始并发测试')

    const namespaces = Object.keys(cfg.api)
    const results = await Promise.all(
      namespaces.map(namespace => testApi(cfg.api![namespace]))
    )
    const displayResult = new Array<[namespace: string, time: number | false]>()
    const api: _TestPluginApiResult = {}
    namespaces.forEach((namespace, i) => {
      api[namespace] = results[i][0]
      displayResult.push([namespace, results[i][1]])
    })

    env.api = api

    if (Object.values(api).some(v => v == false)) {
      setMeta(`测试完成, 无法连接至服务器`)
      throw new Error('can not connect to server')
    }
    setMeta(`测试完成, \n${displayResult.map(ent => `${ent[0]}->${ent[1]}ms`).join('\n')}`)
  }
}
export default new _TestPluginApi