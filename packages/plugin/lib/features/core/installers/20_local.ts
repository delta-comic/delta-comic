import type { PluginArchiveDB } from '@delta-comic/db'

import { PluginInstaller, type PluginInstallerDescription } from '../../../driver/extensionTypes'
import { readLocalFile } from '../../../driver/init/native'
import { isTauriRuntime } from '../../../driver/init/storage'
import { pluginMessageKey } from '../../../i18n'

export class _PluginInstallByLocal extends PluginInstaller {
  public override description: PluginInstallerDescription = {
    title: pluginMessageKey('plugin.install.methods.local.title'),
    description: pluginMessageKey('plugin.install.methods.local.description'),
  }
  public override name = 'local'
  private async installer(input: string): Promise<File> {
    const path = decodeURIComponent(input.replace(/^local:/, ''))
    return await readLocalFile(path)
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
    return isTauriRuntime() && input.startsWith('local:')
  }
}

export default new _PluginInstallByLocal()