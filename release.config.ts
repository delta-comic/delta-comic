import { createReleaseNameTemplate, defineConfig } from '@delta-comic/release-cli'

import pkg from './package.json' with { type: 'json' }
export const releaseBranches = ['main', { name: 'next', channel: 'next', prerelease: 'next' }]

export default defineConfig({
  branches: releaseBranches,
  repositoryUrl: pkg.repository.url,
  tagFormat: '${version}',
  plugins: [
    ['@semantic-release/commit-analyzer', { preset: 'angular' }],
    ['@semantic-release/release-notes-generator', { preset: 'angular' }],
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    [
      '@semantic-release/github',
      { assets: ['dist/release/*'], releaseNameTemplate: createReleaseNameTemplate() },
    ],
  ],
}).withCI({
  jsonVersionPaths: [
    'package.json',
    'packages/app/mobile/package.json',
    'packages/app/desktop/package.json',
    'packages/app/core/package.json',
    'packages/core/sdk/package.json',
    'packages/app/mobile/src-tauri/tauri.conf.json',
    'packages/app/desktop/src-tauri/tauri.conf.json',
    'packages/platform/db/package.json',
    'packages/platform/downloader/package.json',
    'packages/platform/http/package.json',
    'packages/core/logger/package.json',
    'packages/core/model/package.json',
    'packages/plugin/manifest/package.json',
    'packages/plugin/artifact/package.json',
    'packages/plugin/install/package.json',
    'packages/plugin/vite/package.json',
    'packages/plugin/core/package.json',
    'packages/ui/ui/package.json',
    'packages/core/utils/package.json',
  ],
  cargoTomlVersionPaths: [
    ['packages/app/mobile/src-tauri/Cargo.toml', 'package'],
    ['packages/app/desktop/src-tauri/Cargo.toml', 'package'],
    ['Cargo.toml', 'workspace.package'],
  ],
  cargoLockPackageNames: [
    'delta-comic-mobile',
    'delta-comic-desktop',
    'delta-comic-native',
    'tauri-plugin-db',
    'tauri-plugin-downloader',
    'tauri-plugin-http',
    'tauri-plugin-logger',
    'tauri-plugin-plugin',
    'tauri-plugin-utils',
  ],
  workspace: { roots: ['packages'] },
  registry: 'https://npm.pkg.github.com/',
})