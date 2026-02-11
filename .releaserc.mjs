import pkg from './package.json' with { type: 'json' }

const isDryRun = !!process.env.IS_DUR_RUN

const shared = { branches: ['main'], repositoryUrl: pkg.repository.url, tagFormat: '${version}' }

/** @type {import("semantic-release").GlobalConfig} */
const production = {
  ...shared,
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    ['@semantic-release/github', { assets: ['dist/app.apk'] }],
    [
      '@semantic-release/git',
      {
        assets: ['package.json', 'CHANGELOG.md'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
      }
    ]
  ]
}

/** @type {import("semantic-release").GlobalConfig} */
const dev = { ...shared, plugins: ['@semantic-release/commit-analyzer'], dryRun: true }

export default isDryRun ? dev : production