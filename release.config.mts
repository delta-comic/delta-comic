import { GlobalConfig } from 'semantic-release'

import pkg from './package.json' with { type: 'json' }

export default {
  branches: ['main'],
  repositoryUrl: pkg.repository.url,
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    [
      '@semantic-release/exec',
      { prepareCmd: 'node ./script/update-version.mts ${nextRelease.version}' }
    ],
    [
      '@semantic-release/git',
      {
        assets: ['package.json', 'CHANGELOG.md', './src-tauri/tauri.conf.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
      }
    ],
    ['@semantic-release/github', { assets: ['dist/*.tgz'] }]
  ],
  tagFormat: '${nextRelease.version}'
} as GlobalConfig