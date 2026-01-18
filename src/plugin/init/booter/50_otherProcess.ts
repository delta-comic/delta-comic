import { type PluginConfig } from "delta-comic-core"
import { PluginBooter, type PluginBooterSetMeta } from "../utils"


class _TestPluginResource extends PluginBooter {
  public override name = '其他步骤'
  public override async call(cfg: PluginConfig, setMeta: PluginBooterSetMeta): Promise<any> {
    if (!cfg.otherProgress?.length) return

    for (const process of cfg.otherProgress) {
      setMeta({
        name: process.name,
        description: ''
      })
      await process.call(description => {
        setMeta({
          name: process.name,
          description
        })
      })
    }
  }
}
export default new _TestPluginResource