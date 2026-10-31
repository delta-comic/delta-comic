import { defaultClientConditions, defineConfig } from 'vite-plus'
import type { OxfmtConfig } from 'vite-plus/fmt'
import type { OxlintConfig } from 'vite-plus/lint'

import fmt from './.oxfmtrc.json' with { type: 'json' }
import lint from './.oxlintrc.json' with { type: 'json' }

const lintConfig = lint as OxlintConfig

export default defineConfig({
  resolve: { conditions: ['delta-comic-workspace', ...defaultClientConditions] },
  staged: {
    '*': 'vp run codegen:all && vp check --fix && vp run codegen:check',
    '*.{ts,tsx,mts,js,jsx,mjs,vue,html,md,json,yaml,toml}': 'vp exec cspell --no-must-find-files',
  },
  fmt: fmt as OxfmtConfig,
  lint: lintConfig,
  run: {
    cache: { tasks: true, scripts: false },
    tasks: {
      // dev
      'dev': { command: 'vp run @delta-comic/client-app-desktop#dev', cache: false },
      'dev:android': { command: 'vp run @delta-comic/client-app-mobile#dev', cache: false },
      'dev:web': { command: 'vp run @delta-comic/client-app-mobile#dev:web', cache: false },
      // build
      'build:packages': { command: 'vp run -r build', cache: { output: [] } },
      // release
      'release-cli': {
        command: 'vp run --filter @delta-comic/release-cli build',
        cache: { output: ['script/manager/dist/**'] },
      },
      'branch:develop': {
        command: 'vp exec dr branch prepare develop',
        dependsOn: ['release-cli'],
        cache: false,
      },
      'branch:develop:dry-run': {
        command: 'vp exec dr branch prepare develop --dry-run',
        dependsOn: ['release-cli'],
        cache: false,
      },
      'release': { command: 'vp exec dr release run', dependsOn: ['release-cli'], cache: false },
      'release:dry-run': {
        command: 'vp exec dr release plan',
        dependsOn: ['release-cli'],
        cache: false,
      },
      'release:preview': {
        command: 'vp exec dr branch promote preview',
        dependsOn: ['release-cli'],
        cache: false,
      },
      'release:preview:dry-run': {
        command: 'vp exec dr branch promote preview --dry-run',
        dependsOn: ['release-cli'],
        cache: false,
      },
      'release:stable': {
        command: 'vp exec dr branch promote stable',
        dependsOn: ['release-cli'],
        cache: false,
      },
      'release:stable:dry-run': {
        command: 'vp exec dr branch promote stable --dry-run',
        dependsOn: ['release-cli'],
        cache: false,
      },
      // linter
      'typecheck': {
        command: 'vp run -r typecheck',
        dependsOn: ['build:packages'],
        cache: { output: [] },
      },
      'codegen:check': { command: 'node ./script/codegen/check.mts', cache: false },
      // codegen
      'codegen': {
        command:
          'node ./script/codegen/run.mts script/codegen/server.table.mts packages/server/core/server/app/infrastructure/d1/generated',
        cache: false,
      },
      'codegen:all': {
        command:
          'node ./script/codegen/run.mts script/codegen/server.table.mts packages/server/core/server/app/infrastructure/d1/generated && node ./script/codegen/run.mts script/codegen/client.table.mts packages/client/data/db/lib/generated',
        cache: false,
      },
    },
  },
  test: {
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['packages/*/*/*/{app,lib,src,src-web,vite}/**/*.ts', 'script/**/*.{ts,mts}'],
      exclude: ['**/*.d.ts', '**/{test,dist,generated}/**', '**/*.test.ts', '**/src/router.ts'],
      thresholds: { lines: 20, functions: 20, branches: 20, statements: 20 },
    },
    exclude: ['**/node_modules/**', '**/.git/**', '.agents/**'],
    projects: [
      {
        test: { name: 'root', environment: 'node', include: ['script/manager/test/**/*.test.ts'] },
      },
      'packages/shared/core/both',
      'packages/client/core/plugin-artifact',
      'packages/client/core/plugin-install',
      'packages/client/core/plugin-vite',
      'packages/shared/plugin/manifest',
      'packages/client/app/core',
      'packages/client/data/db',
      'packages/client/platform/http',
      'packages/shared/core/logger',
      'packages/client/core/model',
      'packages/client/core/plugin',
      'packages/server/core/server',
      'packages/client/core/utils',
    ],
  },
})