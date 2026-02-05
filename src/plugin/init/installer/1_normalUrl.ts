import axios from 'axios'

import type { PluginArchiveDB } from '@/plugin/db'

import { PluginInstaller, type PluginFile, type PluginInstallerDescription } from '../utils'

export class _PluginInstallByFallbackUrl extends PluginInstaller {
  public override description: PluginInstallerDescription = {
    title: '通过任意URL安装插件',
    description: '从任何你给定的url获取内容，无论内容是什么'
  }
  public override name = 'fallbackUrl'
  private async installer(input: string): Promise<PluginFile> {
    const res = await axios.request<Blob>({ url: input, responseType: 'blob' })
    const fileName = input.split('/').at(-1)!
    return { blob: res.data, fileName }
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
    return URL.canParse(input)
  }
}

export default new _PluginInstallByFallbackUrl()