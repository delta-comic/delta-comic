import type { PluginArchiveDB } from '@delta-comic/db'
import { describe, expect, it } from 'vite-plus/test'

import { _PluginInstallByNormalUrl, type GitHubInstallerDependencies } from './40_github'

const asset = (name: string, version: string) => ({
  browser_download_url: `https://example.test/${version}/${name}`,
  name,
})

const release = (
  version: string,
  options: { draft?: boolean; prerelease?: boolean; withPlugin?: boolean } = {},
) =>
  ({
    assets: [asset('manifest.json', version)].concat(
      options.withPlugin === false ? [] : [asset('plugin.zip', version)],
    ),
    draft: options.draft ?? false,
    prerelease: options.prerelease ?? false,
  }) as never

const createInstaller = (
  pages: readonly (readonly ReturnType<typeof release>[])[],
  supportByVersion: Record<string, string>,
  options: { receivePrerelease?: boolean } = {},
) => {
  const requestedPages: number[] = []
  const downloaded: string[] = []
  const dependencies: GitHubInstallerDependencies = {
    coreVersion: '2.3.0',
    async downloadAsset(url) {
      downloaded.push(url)
      const [, version, name] = new URL(url).pathname.split('/')
      if (name === 'manifest.json') {
        return new Blob([
          JSON.stringify({
            author: 'delta-comic',
            description: 'GitHub installer fixture',
            entry: { jsPath: 'index.mjs' },
            name: { display: 'Fixture', id: 'fixture' },
            require: [],
            version: { plugin: version, supportCore: supportByVersion[version] },
          }),
        ])
      }
      return new Blob([version])
    },
    getConfig: () => ({
      githubToken: 'token',
      receivePerReleaseUpdate: options.receivePrerelease ?? false,
    }),
    async *listReleasePages(owner, repo, token) {
      expect({ owner, repo, token }).toEqual({ owner: 'owner', repo: 'repo', token: 'token' })
      for (const [index, page] of pages.entries()) {
        requestedPages.push(index + 1)
        yield page
      }
    },
  }
  return { downloaded, installer: new _PluginInstallByNormalUrl(dependencies), requestedPages }
}

describe('GitHub plugin installer', () => {
  it.each([
    ['install', (installer: _PluginInstallByNormalUrl) => installer.download('gh:owner/repo')],
    [
      'update',
      (installer: _PluginInstallByNormalUrl) =>
        installer.update({ installInput: 'gh:owner/repo' } as PluginArchiveDB.Archive),
    ],
  ])('uses the newest compatible paginated release for %s', async (_, run) => {
    const { installer, requestedPages } = createInstaller(
      [[release('3.0.0')], [release('2.2.0'), release('2.1.0')]],
      { '2.1.0': '*', '2.2.0': '^2.3.0', '3.0.0': '^3.0.0' },
    )

    const file = await run(installer)

    expect(await file.text()).toBe('2.2.0')
    expect(requestedPages).toEqual([1, 2])
  })

  it('stops pagination after the first compatible release', async () => {
    const { installer, requestedPages } = createInstaller(
      [[release('2.2.0')], [release('2.1.0')]],
      { '2.1.0': '*', '2.2.0': '*' },
    )

    await expect(installer.download('gh:owner/repo')).resolves.toBeInstanceOf(File)
    expect(requestedPages).toEqual([1])
  })

  it('skips drafts, prereleases, incomplete releases, and invalid manifests', async () => {
    const { installer } = createInstaller(
      [
        [
          release('2.5.0', { draft: true }),
          release('2.4.0', { prerelease: true }),
          release('2.3.1', { withPlugin: false }),
          release('broken'),
          release('2.3.0'),
        ],
      ],
      { '2.3.0': '*', 'broken': undefined as never },
    )

    const file = await installer.download('gh:owner/repo')

    expect(await file.text()).toBe('2.3.0')
  })

  it('accepts a compatible prerelease when configured', async () => {
    const { installer } = createInstaller(
      [[release('2.4.0-beta.1', { prerelease: true }), release('2.3.0')]],
      { '2.3.0': '*', '2.4.0-beta.1': '*' },
      { receivePrerelease: true },
    )

    const file = await installer.download('gh:owner/repo')

    expect(await file.text()).toBe('2.4.0-beta.1')
  })

  it('returns the compatible release manifest', async () => {
    const { installer } = createInstaller([[release('3.0.0'), release('2.3.0')]], {
      '2.3.0': '^2.3.0',
      '3.0.0': '^3.0.0',
    })

    const file = await installer.fetchPluginMetaFile('gh:owner/repo')

    await expect(file.text()).resolves.toContain('"plugin":"2.3.0"')
  })

  it('reports when all release pages are incompatible', async () => {
    const { installer, requestedPages } = createInstaller(
      [[release('4.0.0')], [release('3.0.0')]],
      { '3.0.0': '^3.0.0', '4.0.0': '^4.0.0' },
    )

    await expect(installer.download('gh:owner/repo')).rejects.toThrow(
      'plugin.install.errors.noCompatibleRelease',
    )
    expect(requestedPages).toEqual([1, 2])
  })
})