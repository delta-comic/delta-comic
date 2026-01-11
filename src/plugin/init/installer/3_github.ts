import type { PluginArchiveDB } from "@/plugin/db"
import { PluginInstaller, type PluginFile, type PluginInstallerDescription } from "../utils"
import { Utils } from "delta-comic-core"
import axios from "axios"
import { Octokit } from "@octokit/rest"

export class _PluginInstallByNormalUrl extends PluginInstaller {
  public override description: PluginInstallerDescription
    = {
      title: '通过Github安装插件',
      description: '输入形如: "gh:owner/repo"的内容'
    }
  public override name = 'github'
  private async installer(input: string, { createLoading, createProgress }: Utils.message.DownloadMessageBind): Promise<PluginFile> {
    const octokit = new Octokit
    const asset = await createLoading('获取仓库信息', async c => {
      c.retryable = true
      c.description = '请求中'
      const [owner, repo] = input.replace(/^gh:/, '').split('/')
      const { data: release } = await octokit.rest.repos.getLatestRelease({ owner, repo })
      const assets = release.assets[0]
      if (!assets) throw new Error('未找到资源')
      return assets
    })

    const blob = await createProgress('下载插件中', async c => {
      c.retryable = true
      c.description = '下载中'
      const res = await axios.request<Blob>({
        url: asset.browser_download_url,
        responseType: 'blob',
        onDownloadProgress: progressEvent => {
          if (!progressEvent.lengthComputable) c.progress = 100
          else c.progress = progressEvent.loaded / progressEvent.total! * 100
        }
      })
      return res.data
    })
    return {
      fileName: asset.name,
      blob
    }
  }
  public override async install(input: string): Promise<PluginFile> {
    const file = await Utils.message.createDownloadMessage('下载插件-github', m => this.installer(input, m))
    return file
  }
  public override async update(pluginMeta: PluginArchiveDB.Meta): Promise<PluginFile> {
    const file = await Utils.message.createDownloadMessage('更新插件-github', m => this.installer(pluginMeta.installInput, m))
    return file
  }
  public override isMatched(input: string): boolean {
    return input.startsWith('gh:') && input.split('/').length === 2
  }

}

export default new _PluginInstallByNormalUrl