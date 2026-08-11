import { Octokit } from '@octokit/rest'

import { pluginCatalogIdFromInstallInput, type PluginInstallCatalog } from './catalog'
import type { PluginInstallInput, PluginSourceResolver, ResolvedPluginSource } from './contracts'
import { isPluginManifestCompatible, parsePluginManifest } from './manifest'

export class LocalFileSourceResolver implements PluginSourceResolver {
  public readonly id = 'local-file'

  public matches(input: PluginInstallInput): input is File {
    return typeof input !== 'string'
  }

  public async resolve(input: PluginInstallInput): Promise<ResolvedPluginSource> {
    if (typeof input === 'string') throw new TypeError('local file resolver requires a File')
    return { file: input, installInput: '', resolverId: this.id }
  }
}

export class HttpSourceResolver implements PluginSourceResolver {
  public readonly id = 'http'

  public matches(input: PluginInstallInput): input is string {
    return typeof input === 'string' && /^https?:\/\//i.test(input)
  }

  public async resolve(
    input: PluginInstallInput,
    signal: AbortSignal,
  ): Promise<ResolvedPluginSource> {
    if (typeof input !== 'string') throw new TypeError('HTTP resolver requires a URL')
    const response = await fetch(input, { signal })
    if (!response.ok) throw new Error(`plugin download failed: ${response.status}`)
    const name = new URL(input).pathname.split('/').at(-1) || 'plugin.zip'
    return {
      file: new File([await response.blob()], name),
      installInput: input,
      resolverId: this.id,
    }
  }
}

export interface GitHubSourceResolverOptions {
  readonly coreVersion: string
  readonly includePrereleases?: () => boolean
  readonly token?: string
}

export class GitHubSourceResolver implements PluginSourceResolver {
  public readonly id = 'github'

  public constructor(private readonly options: GitHubSourceResolverOptions) {}

  public matches(input: PluginInstallInput): input is string {
    return typeof input === 'string' && /^gh:[^/]+\/[^/]+$/.test(input)
  }

  public async resolve(input: PluginInstallInput, signal: AbortSignal) {
    if (typeof input !== 'string') throw new TypeError('GitHub resolver requires a repository')
    const [owner, repo] = input.slice(3).split('/') as [string, string]
    const octokit = new Octokit({ auth: this.options.token })
    const includePrereleases = this.options.includePrereleases?.() ?? false
    const pages = octokit.paginate.iterator(octokit.rest.repos.listReleases, {
      owner,
      per_page: 100,
      repo,
      request: { signal },
    })
    for await (const page of pages) {
      for (const release of page.data) {
        if (release.draft || (release.prerelease && !includePrereleases)) continue
        const manifestAsset = release.assets.find(asset => asset.name === 'manifest.json')
        const packageAsset = release.assets.find(asset => asset.name === 'plugin.zip')
        if (!manifestAsset || !packageAsset) continue
        const manifestResponse = await fetch(manifestAsset.browser_download_url, { signal })
        if (!manifestResponse.ok) continue
        const manifest = parsePluginManifest(await manifestResponse.json())
        if (!isPluginManifestCompatible(manifest, this.options.coreVersion)) continue
        const packageResponse = await fetch(packageAsset.browser_download_url, { signal })
        if (!packageResponse.ok)
          throw new Error(`plugin download failed: ${packageResponse.status}`)
        return {
          file: new File([await packageResponse.blob()], packageAsset.name),
          installInput: input,
          resolverId: this.id,
        }
      }
    }
    throw new Error(`no compatible plugin release found for ${owner}/${repo}`)
  }
}

export class MarketplaceSourceResolver implements PluginSourceResolver {
  public readonly id = 'marketplace'

  public constructor(
    private readonly catalog: PluginInstallCatalog,
    private readonly sources: readonly PluginSourceResolver[],
  ) {}

  public matches(input: PluginInstallInput): input is string {
    return pluginCatalogIdFromInstallInput(input) !== undefined
  }

  public async resolve(input: PluginInstallInput, signal: AbortSignal) {
    if (typeof input !== 'string') {
      throw new TypeError('marketplace resolver requires a plugin catalog id')
    }
    const plugin = pluginCatalogIdFromInstallInput(input)
    if (!plugin) throw new TypeError('marketplace resolver requires a plugin catalog id')
    const redirected = await this.catalog.resolveInstallInput(plugin, signal)
    const resolver = this.sources.find(source => source.matches(redirected))
    if (!resolver)
      throw new Error(`plugin catalog returned an unsupported install source: ${redirected}`)
    const source = await resolver.resolve(redirected, signal)
    return { ...source, installInput: input, resolverId: this.id }
  }
}