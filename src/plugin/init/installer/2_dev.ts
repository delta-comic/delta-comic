import type { PluginArchiveDB } from "@/plugin/db"
import { PluginInstaller, type PluginFile, type PluginInstallerDescription } from "../utils"
import axios from "axios"

export class _PluginInstallByDev extends PluginInstaller {
  public override description: PluginInstallerDescription
    = {
      title: '安装Develop Userscript插件',
      description: '输入形如: "localhost"或者一个可以不含port的ip'
    }
  public override name = 'devUrl'
  private async installer(input: string): Promise<PluginFile> {
    const res = await axios.request<string>({
      url: `http://${/:\d+$/.test(input) ? input : input + ':6173'}/__vite-plugin-monkey.install.user.js?origin=http%3A%2F%2F${input}%3A6173`,
      responseType: 'text'
    })
    const noPort = input.replace(/:\d+$/, '')
    return {
      blob: new Blob([res.data
        .replaceAll('localhost', noPort)
        .replaceAll('127.0.0.1', noPort)]),
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
    return /((\d+\.?)+)|(localhost)(:\d+)?/.test(input)
  }

}

export default new _PluginInstallByDev