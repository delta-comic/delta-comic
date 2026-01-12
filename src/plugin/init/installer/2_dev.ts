import type { PluginArchiveDB } from "@/plugin/db"
import { PluginInstaller, type PluginFile, type PluginInstallerDescription } from "../utils"
import axios from "axios"

export class _PluginInstallByDev extends PluginInstaller {
  public override description: PluginInstallerDescription
    = {
      title: '安装Develop Userscript插件',
      description: '输入形如: "localhost"或者一个不含port的ip'
    }
  public override name = 'devUrl'
  private async installer(input: string): Promise<PluginFile> {
    const res = await axios.request<string>({
      url: `http://${input}:6173/__vite-plugin-monkey.install.user.js?origin=http%3A%2F%2F${input}%3A6173`,
      responseType: 'text'
    })
    return {
      blob: new Blob([res.data
        .replaceAll('localhost', input)
        .replaceAll('127.0.0.1', input)]),
      fileName: 'dev.js'
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
    return /((\d+\.?)+)|(localhost)/.test(input)
  }

}

export default new _PluginInstallByDev