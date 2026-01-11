import type { PluginArchiveDB } from "@/plugin/db"
import { PluginInstaller, type PluginFile, type PluginInstallerDescription } from "../utils"
import { Utils } from "delta-comic-core"
import axios from "axios"

export class _PluginInstallByFallbackUrl extends PluginInstaller {
  public override description: PluginInstallerDescription
    = {
      title: '通过任意URL安装插件',
      description: '从任何你给定的url获取内容，无论内容是什么'
    }
  public override name = 'fallbackUrl'
  private async installer(input: string, { createProgress }: Utils.message.DownloadMessageBind): Promise<PluginFile> {
    const code = await createProgress('下载插件中', async c => {
      c.retryable = true
      c.description = '下载中'
      const res = await axios.request<Blob>({
        url: input,
        responseType: 'blob',
        onDownloadProgress: progressEvent => {
          if (!progressEvent.lengthComputable) c.progress = 100
          else c.progress = progressEvent.loaded / progressEvent.total! * 100
        }
      })
      return res.data
    })
    const fileName = input.split('/').at(-1)!
    return {
      blob: code,
      fileName
    }
  }

  public override async install(input: string): Promise<PluginFile> {
    const file = await Utils.message.createDownloadMessage('下载插件-回退URL', m => this.installer(input, m))
    return file
  }
  public override async update(pluginMeta: PluginArchiveDB.Meta): Promise<PluginFile> {
    const file = await Utils.message.createDownloadMessage('更新插件-回退URL', m => this.installer(pluginMeta.installInput, m))
    return file
  }
  public override isMatched(input: string): boolean {
    return URL.canParse(input)
  }

}

export default new _PluginInstallByFallbackUrl