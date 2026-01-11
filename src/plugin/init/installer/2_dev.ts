import type { PluginArchiveDB } from "@/plugin/db"
import { PluginInstaller, type PluginFile, type PluginInstallerDescription } from "../utils"
import { Utils } from "delta-comic-core"
import axios from "axios"

export class _PluginInstallByDev extends PluginInstaller {
  public override description: PluginInstallerDescription
    = {
      title: '安装Develop Userscript插件',
      description: '输入形如: "localhost"或者一个不含port的ip'
    }
  public override name = 'devUrl'
  private async installer(input: string, { createProgress }: Utils.message.DownloadMessageBind): Promise<PluginFile> {
    const code = await createProgress('下载插件中', async c => {
      c.retryable = true
      c.description = '下载中'
      const res = await axios.request<string>({
        url: `http://${input}:6173/__vite-plugin-monkey.install.user.js?origin=http%3A%2F%2F${input}%3A6173`,
        responseType: 'text',
        onDownloadProgress: progressEvent => {
          if (!progressEvent.lengthComputable) c.progress = 100
          else c.progress = progressEvent.loaded / progressEvent.total! * 100
        }
      })
      return res.data
    })
    return {
      blob: new Blob([code
        .replaceAll('localhost', input)
        .replaceAll('127.0.0.1', input)]),
      fileName: 'dev.js'
    }
  }
  public override async install(input: string): Promise<PluginFile> {
    const file = await Utils.message.createDownloadMessage('下载插件-DevUs', m => this.installer(input, m))
    return file
  }
  public override async update(pluginMeta: PluginArchiveDB.Meta): Promise<PluginFile> {
    const file = await Utils.message.createDownloadMessage('更新插件-DevUs', m => this.installer(pluginMeta.installInput, m))
    return file
  }
  public override isMatched(input: string): boolean {
    return /((\d+\.?)+)|(localhost)/.test(input)
  }

}

export default new _PluginInstallByDev