import type { PluginArchiveDB } from "@/plugin/db"
import { PluginInstaller, type PluginFile, type PluginInstallerDescription } from "../utils"
import axios from "axios"
import { Octokit } from "@octokit/rest"

export class _PluginInstallByNormalUrl extends PluginInstaller {
  public override description: PluginInstallerDescription
    = {
      title: '通过Github安装插件',
      description: '输入形如: "gh:owner/repo"的内容'
    }
  public override name = 'github'
  private async installer(input: string): Promise<PluginFile> {
    const octokit = new Octokit
    const [owner, repo] = input.replace(/^gh:/, '').split('/')
    const { data: release } = await octokit.rest.repos.getLatestRelease({ owner, repo })
    const asset = release.assets[0]
    if (!asset) throw new Error('未找到资源')

    const res = await axios.request<Blob>({
      url: asset.browser_download_url,
      responseType: 'blob'
    })

    return {
      fileName: asset.name,
      blob: res.data
    }
  }
  public override async install(input: string): Promise<PluginFile> {
    const file = await this.installer(input)
    return file
  }
  public override async update(pluginMeta: PluginArchiveDB.Meta): Promise<PluginFile> {
    const file = await this.installer(pluginMeta.installInput)
    return file
  }
  public override isMatched(input: string): boolean {
    return input.startsWith('gh:') && input.split('/').length === 2
  }

}

export default new _PluginInstallByNormalUrl