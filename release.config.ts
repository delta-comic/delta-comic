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
    'script/manager/package.json',
    'packages/app/package.json',
    'packages/platform/package.json',
    'packages/sdk/package.json',
    'packages/app/src-tauri/tauri.conf.json',
  ],
  cargoTomlVersionPaths: [
    ['packages/app/src-tauri/Cargo.toml', 'package'],
    ['Cargo.toml', 'workspace.package'],
  ],
  cargoLockPackageNames: [
    'delta-comic',
    'tauri-plugin-db',
    'tauri-plugin-downloader',
    'tauri-plugin-http',
    'tauri-plugin-logger',
    'tauri-plugin-plugin',
    'tauri-plugin-utils',
  ],
  workspace: { manifests: ['packages/*/package.json', 'script/*/package.json'] },
  registry: 'https://npm.pkg.github.com/',
})