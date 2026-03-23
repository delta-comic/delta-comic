import type { PluginArchiveDB } from '@delta-comic/db'
import { Octokit } from '@octokit/rest'
import axios from 'axios'
import { isEmpty } from 'es-toolkit/compat'

import { appConfig, useConfig } from '@/config'

import { PluginInstaller, type PluginInstallerDescription } from '../utils'

export class _PluginInstallByNormalUrl extends PluginInstaller {
  public override description: PluginInstallerDescription = {
    title: '通过Github安装插件',
    description: '输入形如: "gh:owner/repo"的内容'
  }
  public override name = 'github'
  private async installer(input: string): Promise<File> {
    try {
      var config = useConfig().$load(appConfig).value.githubToken
    } catch (error) {
      console.error('fail to get github token', error)
      var config = ''
    }

    const octokit = new Octokit({ auth: isEmpty(config) ? undefined : config })
    const [owner, repo] = input.replace(/^gh:/, '').split('/')
    const { data: release } = await octokit.rest.repos.getLatestRelease({ owner, repo })
    const asset = release.assets[0]
    if (!asset) throw new Error('未找到资源')

    const { data } = await axios.request<Blob>({
      url: asset.browser_download_url,
      responseType: 'blob',
      timeout: 1000 * 60 * 5
    })

    return new File([data], asset.name)
  }
  public override async download(input: string): Promise<File> {
    const file = await this.installer(input)
    return file
  }
  public override async update(pluginMeta: PluginArchiveDB.Archive): Promise<File> {
    const file = await this.installer(pluginMeta.installInput)
    return file
  }
  public override isMatched(input: string): boolean {
    return input.startsWith('gh:') && input.split('/').length === 2
  }
}

export default new _PluginInstallByNormalUrl()