import type { PluginArchiveDB } from '@delta-comic/db'

import { PluginInstaller, type PluginInstallerDescription } from '../../../driver/extensionTypes'
import { pluginI18n, pluginMessageKey } from '../../../i18n'
import {
  AwesomeRegistryClient,
  marketplaceDownloadToInstallInput,
  type AwesomePluginListing,
} from '../../../marketplace'

export interface AwesomeInstallerRegistry {
  findListing(id: string): Promise<AwesomePluginListing>
  loadManifest(listing: AwesomePluginListing): Promise<PluginArchiveDB.Meta | undefined>
}

export class _PluginInstallByAwesome extends PluginInstaller {
  public override description: PluginInstallerDescription = {
    title: pluginMessageKey('plugin.install.methods.marketplace.title'),
    description: pluginMessageKey('plugin.install.methods.marketplace.description'),
  }
  public override name = 'awesome'
  public constructor(
    private readonly registry: AwesomeInstallerRegistry = new AwesomeRegistryClient(),
  ) {
    super()
  }

  private async listing(input: string) {
    const match = /^ap:([A-Za-z0-9][A-Za-z0-9_-]{0,63})$/.exec(input)
    if (!match) {
      throw new Error(pluginI18n.translate('plugin.install.errors.invalidMarketplaceId', { input }))
    }
    return await this.registry.findListing(match[1])
  }

  private async installer(input: string): Promise<File | string> {
    const listing = await this.listing(input)
    return marketplaceDownloadToInstallInput(listing.download)
  }
  public override async download(input: string): Promise<File | string> {
    const file = await this.installer(input)
    return file
  }
  public override async update(pluginMeta: PluginArchiveDB.Archive): Promise<File | string> {
    const file = await this.installer(pluginMeta.installInput)
    return file
  }
  public override async fetchPluginMetaFile(input: string): Promise<File | string> {
    const listing = await this.listing(input)
    const manifest = await this.registry.loadManifest(listing)
    if (!manifest) return marketplaceDownloadToInstallInput(listing.download)
    return new File([JSON.stringify(manifest)], 'manifest.json', { type: 'application/json' })
  }
  public override isMatched(input: string): boolean {
    return /^ap:[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(input)
  }
}

export default new _PluginInstallByAwesome()