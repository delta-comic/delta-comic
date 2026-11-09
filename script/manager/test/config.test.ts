import { expect, it } from 'vitest'

import { defineConfig, loadCIConfig, releasePluginName } from '../src/config.ts'

it('adds the release plugin and keeps semantic-release options', () => {
  const config = defineConfig({
    branches: ['main'],
    repositoryUrl: 'https://github.com/example/repository.git',
    tagFormat: '${version}',
    plugins: [releasePluginName, '@semantic-release/changelog'],
  }).withCI({ registry: 'https://registry.example.com', workspace: { roots: ['packages'] } })

  expect(config.plugins).toEqual([
    '@semantic-release/changelog',
    [
      releasePluginName,
      { registry: 'https://registry.example.com', workspace: { roots: ['packages'] } },
    ],
  ])
})

it('loads CI options from the semantic-release config', async () => {
  await expect(loadCIConfig(process.cwd())).resolves.toMatchObject({
    registry: 'https://npm.pkg.github.com/',
    msiConfigPath: 'packages/app/desktop/src-tauri/tauri.windows.conf.json',
  })
})