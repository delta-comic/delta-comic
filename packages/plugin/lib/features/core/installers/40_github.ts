import type { PluginArchiveDB } from '@delta-comic/db'
import { Octokit } from '@octokit/rest'
import ky from 'ky'

import pkg from '../../../../package.json'
import { useConfig } from '../../../config'
import { PluginInstaller, type PluginInstallerDescription } from '../../../driver/extensionTypes'
import { pluginI18n, pluginMessageKey } from '../../../i18n'
import { isPluginManifestCompatible, parsePluginManifest } from '../../../manifest'

type GitHubRelease = Awaited<ReturnType<Octokit['rest']['repos']['listReleases']>>['data'][number]

interface GitHubInstallerConfig {
  githubToken: string
  receivePerReleaseUpdate: boolean
}

export interface GitHubInstallerDependencies {
  coreVersion: string
  downloadAsset: (url: string) => Promise<Blob>
  getConfig: () => GitHubInstallerConfig
  listReleasePages: (
    owner: string,
    repo: string,
    token?: string,
  ) => AsyncIterable<readonly GitHubRelease[]>
}

const defaultDependencies: GitHubInstallerDependencies = {
  coreVersion: pkg.version,
  downloadAsset: async url => await ky.get(url, { retry: 2, timeout: 1000 * 60 * 5 }).blob(),
  getConfig: () => useConfig().$loadApp().data.value,
  async *listReleasePages(owner, repo, token) {
    const octokit = new Octokit({ auth: token })
    const pages = octokit.paginate.iterator(octokit.rest.repos.listReleases, {
      owner,
      per_page: 100,
      repo,
    })
    for await (const page of pages) yield page.data
  },
}

const parseRepository = (input: string) => {
  const [owner, repo, ...rest] = input.replace(/^gh:/, '').split('/')
  if (!owner || !repo || rest.length > 0) {
    throw new Error(pluginI18n.translate('plugin.install.errors.invalidGitHub', { input }))
  }
  return { owner, repo }
}

const decodeManifest = async (blob: Blob): Promise<PluginArchiveDB.Meta | undefined> => {
  try {
    return parsePluginManifest(JSON.parse(await blob.text()))
  } catch {
    return undefined
  }
}

interface CompatibleRelease {
  manifest: Blob
  plugin: GitHubRelease['assets'][number]
}

export class _PluginInstallByNormalUrl extends PluginInstaller {
  public override description: PluginInstallerDescription = {
    title: pluginMessageKey('plugin.install.methods.github.title'),
    description: pluginMessageKey('plugin.install.methods.github.description'),
  }
  public override name = 'github'

  public constructor(private readonly dependencies = defaultDependencies) {
    super()
  }

  private async findCompatibleRelease(input: string): Promise<CompatibleRelease> {
    const { githubToken, receivePerReleaseUpdate } = this.dependencies.getConfig()
    const { owner, repo } = parseRepository(input)
    const pages = this.dependencies.listReleasePages(owner, repo, githubToken || undefined)

    for await (const releases of pages) {
      for (const release of releases) {
        if (release.draft || (!receivePerReleaseUpdate && release.prerelease)) continue

        const manifestAsset = release.assets.find(asset => asset.name === 'manifest.json')
        const plugin = release.assets.find(asset => asset.name === 'plugin.zip')
        if (!manifestAsset || !plugin) continue

        const manifest = await this.dependencies.downloadAsset(manifestAsset.browser_download_url)
        const meta = await decodeManifest(manifest)
        if (!meta || !isPluginManifestCompatible(meta, this.dependencies.coreVersion)) {
          continue
        }
        return { manifest, plugin }
      }
    }

    throw new Error(
      pluginI18n.translate('plugin.install.errors.noCompatibleRelease', {
        version: this.dependencies.coreVersion,
      }),
    )
  }

  private async installer(input: string): Promise<File> {
    const { plugin } = await this.findCompatibleRelease(input)
    const data = await this.dependencies.downloadAsset(plugin.browser_download_url)
    return new File([data], plugin.name)
  }

  public override async download(input: string): Promise<File> {
    return await this.installer(input)
  }

  public override async update(pluginMeta: PluginArchiveDB.Archive): Promise<File> {
    return await this.installer(pluginMeta.installInput)
  }

  public override async fetchPluginMetaFile(input: string): Promise<File> {
    const { manifest } = await this.findCompatibleRelease(input)
    return new File([manifest], 'manifest.json')
  }

  public override isMatched(input: string): boolean {
    return input.startsWith('gh:') && input.split('/').length === 2
  }
}

export default new _PluginInstallByNormalUrl()