import type { PluginArchiveDB } from '@delta-comic/db'
import axios from 'axios'

import { PluginInstaller, type PluginInstallerDescription } from '../utils'

const linkBase = `https://raw.githubusercontent.com/delta-comic/awesome-plugins/refs/heads/main/pages`

interface ItemSchema {
  author: string[]
  download: string
  id: string
}

export class _PluginInstallByAwesome extends PluginInstaller {
  public override description: PluginInstallerDescription = {
    title: '快速安装插件',
    description: '输入形如: "ap:jmcomic"的内容'
  }
  public override name = 'awesome'
  private async installer(input: string): Promise<File | string> {
    const id = input.replace(/^ap:/, '')
    const { data } = await axios.get<ItemSchema>(`${linkBase}/${id}.json`, { responseType: 'json' })
    return data.download
  }
  public override async install(input: string): Promise<File | string> {
    const file = await this.installer(input)
    return file
  }
  public override async update(pluginMeta: PluginArchiveDB.Meta): Promise<File | string> {
    const file = await this.installer(pluginMeta.installInput)
    return file
  }
  public override isMatched(input: string): boolean {
    return /^ap:[A-Za-z0-9\-\_]+$/.test(input)
  }
}

export default new _PluginInstallByAwesome()