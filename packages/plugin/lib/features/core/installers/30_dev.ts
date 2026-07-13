import type { PluginArchiveDB } from '@delta-comic/db'
import ky from 'ky'

import { PluginInstaller, type PluginInstallerDescription } from '../../../driver/extensionTypes'
import { prepareDevScript } from '../../../driver/init/native'
import { pluginMessageKey } from '../../../i18n'

export class _PluginInstallByDev extends PluginInstaller {
  public override description: PluginInstallerDescription = {
    title: pluginMessageKey('plugin.install.methods.development.title'),
    description: pluginMessageKey('plugin.install.methods.development.description'),
  }
  public override name = 'devUrl'
  private async installer(input: string): Promise<File> {
    const res = await ky
      .get(
        `http://${/:\d+$/.test(input) ? input : input + ':6173'}/__vite-plugin-monkey.install.user.js?origin=http%3A%2F%2F${input}%3A6173`,
      )
      .text()
    const processed = await prepareDevScript(input, res)
    return new File([processed], 'us.js')
  }
  public override async download(input: string): Promise<File> {
    const file = await this.installer(input)
    return file
  }
  public override async update(pluginMeta: PluginArchiveDB.Archive): Promise<File> {
    const file = await this.installer(pluginMeta.installInput)
    return file
  }
  public override async fetchPluginMetaFile(input: string): Promise<File | string> {
    const file = await this.installer(input)
    return file
  }
  public override isMatched(input: string): boolean {
    return /^(((\d+\.?)+)|(localhost))(:\d+)?$/.test(input)
  }
}

export default new _PluginInstallByDev()