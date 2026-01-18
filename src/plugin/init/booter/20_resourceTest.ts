import { uni, type PluginConfig } from "delta-comic-core"
import { PluginBooter, type PluginBooterSetMeta } from "../utils"
import { testResourceApi } from "./utils"


class _TestPluginResource extends PluginBooter {
  public override name = '资源链接测试'
  public override async call(cfg: PluginConfig, setMeta: PluginBooterSetMeta): Promise<any> {
    if (!cfg.resource?.types?.length) return
    setMeta('开始并发测试')

    const types = cfg.resource.types.map(v => ({ type: v.type, val: v }))
    const results = await Promise.all(
      types.map(type => testResourceApi(type.val))
    )
    const displayResult = new Array<[type: (typeof types)[number], time: number | false]>()
    types.forEach((type, i) => {
      if (results[i][1]) uni.resource.Resource.precedenceFork.set([cfg.name, type.type], results[i][0])
      displayResult.push([type, results[i][1]])
    })
    if (results.some(v => v[1] == false)) {
      setMeta(`测试完成, 无法连接至服务器`)
      throw new Error('[plugin test] can not connect to server')
    }
    setMeta(`测试完成, \n${displayResult.map(ent => `${ent[0]}->${ent[1]}ms`).join('\n')}`)
  }
}
export default new _TestPluginResource