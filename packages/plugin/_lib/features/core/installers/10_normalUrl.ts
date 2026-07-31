import type { PluginArchiveDB } from '@delta-comic/db'

import { PluginInstaller, type PluginInstallerDescription } from '../../../driver/extensionTypes'
import { pluginMessageKey } from '../../../i18n'

import { downloadInstallerAsset } from './downloadAsset'

const getFileName = (input: string): string => {
  const url = new URL(input)
  const encoded = url.pathname.split('/').filter(Boolean).at(-1) ?? url.hostname
  let decoded = encoded
  try {
    decoded = decodeURIComponent(encoded)
  } catch {
    // Keep malformed percent escapes verbatim; URL parsing has already validated the input.
  }
  const withoutControlCharacters = [...decoded]
    .map(character => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127 ? '_' : character
    })
    .join('')
  return withoutControlCharacters.replace(/[<>:"/\\|?*]/g, '_').trim() || 'us.js'
}

export class _PluginInstallByFallbackUrl extends PluginInstaller {
  public override description: PluginInstallerDescription = {
    title: pluginMessageKey('plugin.install.methods.url.title'),
    description: pluginMessageKey('plugin.install.methods.url.description'),
  }
  public override name = 'fallbackUrl'
  private async installer(input: string): Promise<File> {
    const data = await downloadInstallerAsset(input, { retry: 3 })
    return new File([data], getFileName(input))
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