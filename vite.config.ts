import { resolve } from 'node:path'

import { defineConfig } from 'vite-plus'
import type { OxfmtConfig } from 'vite-plus/fmt'
import type { OxlintConfig } from 'vite-plus/lint'

import fmt from './.oxfmtrc.json' with { type: 'json' }
import lint from './.oxlintrc.json' with { type: 'json' }

const lintConfig = lint as OxlintConfig
const uiTailwindConfigPath = resolve(import.meta.dirname, 'packages/ui/src/index.css')

export default defineConfig({
  staged: {
    '*': 'vp run codegen:all && vp check --fix && vp run codegen:check',
    '*.{ts,tsx,mts,js,jsx,mjs,vue,html,md,json,yaml,toml}': 'vp exec cspell --no-must-find-files',
  },
  fmt: fmt as OxfmtConfig,
  lint: {
    ...lintConfig,
    settings: { ...lintConfig.settings, tailwindcss: { cssConfigPath: uiTailwindConfigPath } },
  },
  run: {
    cache: { tasks: true, scripts: false },
    tasks: {
      'branch:develop': { command: 'node ./script/release-branches.mts develop', cache: false },
      'branch:develop:dry-run': {
        command: 'node ./script/release-branches.mts develop --dry-run',
        cache: false,
      },
      'check': { command: 'vp check', output: [] },
      'dev': { command: 'vp run app#dev', cache: false },
      'dev:web': { command: 'vp run app#dev:web', cache: false },
      'lib-build': { command: 'node -e ""', dependsOn: ['app#build'], output: [] },
      'release': { command: 'node ./script/release.mts', cache: false },
      'release:dry-run': { command: 'node ./script/release.mts --dry-run', cache: false },
      'release:preview': { command: 'node ./script/release-branches.mts preview', cache: false },
      'release:preview:dry-run': {
        command: 'node ./script/release-branches.mts preview --dry-run',
        cache: false,
      },
      'release:stable': { command: 'node ./script/release-branches.mts stable', cache: false },
      'release:stable:dry-run': {
        command: 'node ./script/release-branches.mts stable --dry-run',
        cache: false,
      },
      'set-ver': { command: 'node ./script/set-version.mts', cache: false },
      'test': { command: 'vp test', cache: false, dependsOn: ['lib-build'] },
      'test:coverage': {
        command: 'vp test run --coverage',
        dependsOn: ['lib-build'],
        output: ['coverage/**'],
      },
      'typecheck': { command: 'vp run -r typecheck', dependsOn: ['lib-build'], output: [] },
      'vp:install': { command: 'vp install', cache: false },
      'codegen': {
        command:
          'node ./script/codegen/run.mts script/codegen/server.table.mts packages/server/app/infrastructure/d1/generated',
        cache: false,
      },
      'codegen:all': {
        command:
          'node ./script/codegen/run.mts script/codegen/server.table.mts packages/server/app/infrastructure/d1/generated && node ./script/codegen/run.mts script/codegen/client.table.mts packages/db/lib/generated',
        cache: false,
      },
      'codegen:check': { command: 'node ./script/codegen/check.mts', cache: false },
    },
  },
  test: {
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'script/**/*.{ts,mts}',
        'packages/app/src/**/*.{ts,tsx}',
        // Declarative route views are exercised through component tests, while the unit coverage
        // gate measures independent application logic and the stateful SFCs mounted by this suite.
        'packages/app/src/{App,AppSetup}.vue',
        'packages/app/src/components/{listSearcher,home/mainPageSearchBar,plugin/index,plugin/PluginPreloadRecoveryAlert}.vue',
        'packages/app/src/components/plugin/marketplace/{PluginMarketplaceCard,PluginMarketplaceFilters}.vue',
        'packages/db/lib/**/*.ts',
        'packages/downloader/lib/**/*.ts',
        'packages/logger/lib/**/*.ts',
        'packages/model/lib/**/*.ts',
        'packages/plugin/{lib,vite}/**/*.ts',
        'packages/server/{app,lib}/**/*.ts',
        'packages/server-admin/src/**/*.{ts,tsx,vue}',
        'packages/ui/{lib,vite}/**/*.{ts,tsx,vue}',
        'packages/utils/{lib,vite}/**/*.ts',
      ],
      exclude: [
        '**/*.{test,spec}.{ts,tsx,mts}',
        '**/*.d.ts',
        '**/*.types.ts',
        '**/{test,__tests__}/**',
        'packages/app/src/icons.tsx',
        'packages/app/src/i18n/locales/schema.ts',
        'packages/app/src/main.tsx',
        'packages/server/app/index.ts',
        'packages/server-admin/src/main.ts',
        'packages/server-admin/src/shared/{api,components}/types.ts',
        'packages/ui/lib/components/form/type.ts',
      ],
      thresholds: { lines: 75, functions: 75, branches: 70, statements: 75 },
    },
    exclude: ['**/node_modules/**', '**/.git/**', '.agents/**'],
    projects: [
      { test: { name: 'root', environment: 'node', include: ['script/test/**/*.test.ts'] } },
      'packages/app',
      'packages/db',
      'packages/downloader',
      'packages/logger',
      'packages/model',
      'packages/plugin',
      'packages/server',
      'packages/server-admin',
      'packages/ui',
      'packages/utils',
    ],
  },
})