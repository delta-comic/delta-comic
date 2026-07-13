import type { PluginArchiveDB } from '@delta-comic/db'
import ky from 'ky'

import { PluginInstaller, type PluginInstallerDescription } from '../../../driver/extensionTypes'
import { pluginMessageKey } from '../../../i18n'

export class _PluginInstallByFallbackUrl extends PluginInstaller {
  public override description: PluginInstallerDescription = {
    title: pluginMessageKey('plugin.install.methods.url.title'),
    description: pluginMessageKey('plugin.install.methods.url.description'),
  }
  public override name = 'fallbackUrl'
  private async installer(input: string): Promise<File> {
    const res = await ky.get(input, { retry: 3, timeout: 1000 * 60 * 5 }).blob()
    const name = input.split('/').at(-1) ?? 'us.js'
    return new File([res], name)
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
    return URL.canParse(input)
  }
}

export default new _PluginInstallByFallbackUrl()