import { convertFileSrc } from '@tauri-apps/api/core'
import { readFile } from '@tauri-apps/plugin-fs'

import type { PluginArchiveDB } from '@/plugin/db'

import { PluginInstaller, type PluginInstallerDescription } from '../utils'

export class _PluginInstallByLocal extends PluginInstaller {
  public override description: PluginInstallerDescription = {
    title: '安装本地插件',
    description: '输入以: "local:"开头，后接全路径的文本'
  }
  public override name = 'local'
  private async installer(input: string): Promise<File> {
    const path = decodeURIComponent(convertFileSrc(input.replace(/^local:/, ''), 'local'))
    const name = path.split(/\\|\//).at(-1) ?? 'us.js'
    const buffer = await readFile(path)
    return new File([buffer], name)
  }
  public override async install(input: string): Promise<File> {
    const file = await this.installer(input)
    return file
  }
  public override async update(pluginMeta: PluginArchiveDB.Meta): Promise<File> {
    const file = await this.installer(pluginMeta.installInput)
    return file
  }
  public override isMatched(input: string): boolean {
    return input.startsWith('local:')
  }
}

export default new _PluginInstallByLocal()