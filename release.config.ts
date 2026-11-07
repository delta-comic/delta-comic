import { createReleaseNameTemplate } from '@delta-comic/release-cli'
import type { GlobalConfig } from 'semantic-release'

import pkg from './package.json' with { type: 'json' }
export const releaseBranches = ['main', { name: 'next', channel: 'next', prerelease: 'next' }]

export default {
  branches: releaseBranches,
  repositoryUrl: pkg.repository.url,
  tagFormat: '${version}',
  plugins: [
    ['@semantic-release/commit-analyzer', { preset: 'angular' }],
    '@delta-comic/release-ci',
    ['@semantic-release/release-notes-generator', { preset: 'angular' }],
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    [
      '@semantic-release/github',
      { assets: ['dist/release/**/*'], releaseNameTemplate: createReleaseNameTemplate() },
    ],
  ],
} satisfies GlobalConfig