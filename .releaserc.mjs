import pkg from './package.json' with { type: 'json' }

/** @type {import("semantic-release").GlobalConfig} */
export default {
  branches: ['main'],
  repositoryUrl: pkg.repository.url,
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    [
      "@semantic-release/exec",
      {
        "publishCmd": "node ./script/set-version.mts ${nextRelease.version}"
      }
    ],
    [
      '@semantic-release/git',
      {
        assets: [
          'package.json',
          'CHANGELOG.md',
          './src-tauri/tauri.conf.json',
          './src-tauri/Cargo.toml'
        ],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
      }
    ],
    ['@semantic-release/github', { assets: ['dist/*.apk'] }]
  ],
  tagFormat: 'v${version}'
}