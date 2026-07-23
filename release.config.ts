import type { GlobalConfig } from 'semantic-release'

import pkg from './package.json' with { type: 'json' }
import {
  createReleaseNameTemplate,
  releaseNotePresetConfig,
  releaseNoteWriterOptions,
} from './script/release-notes.mts'
export const releaseBranches = ['main', { name: 'next', channel: 'next', prerelease: 'next' }]

export default {
  branches: releaseBranches,
  repositoryUrl: pkg.repository.url,
  tagFormat: '${version}',
  plugins: [
    ['@semantic-release/commit-analyzer', { preset: 'angular' }],
    './script/semantic-release-plugin.mts',
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        presetConfig: releaseNotePresetConfig,
        writerOpts: releaseNoteWriterOptions,
      },
    ],
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    [
      '@semantic-release/github',
      { assets: ['dist/release/**/*'], releaseNameTemplate: createReleaseNameTemplate() },
    ],
  ],
} satisfies GlobalConfig