import { defineConfig } from 'vite-plus'
import type { OxfmtConfig } from 'vite-plus/fmt'
import type { OxlintConfig } from 'vite-plus/lint'

import fmt from './.oxfmtrc.json' with { type: 'json' }
import lint from './.oxlintrc.json' with { type: 'json' }

const lintConfig = lint as OxlintConfig

export default defineConfig({
  staged: {
    '*': 'vp run codegen:all && vp check --fix && vp run codegen:check',
    '*.{ts,tsx,mts,js,jsx,mjs,vue,html,md,json,yaml,toml}': 'vp exec cspell --no-must-find-files',
  },
  fmt: fmt as OxfmtConfig,
  lint: lintConfig,
  run: {
    cache: { tasks: true, scripts: false },
    tasks: {
      'branch:develop': { command: 'node ./script/release-branches.mts develop', cache: false },
      'branch:develop:dry-run': {
        command: 'node ./script/release-branches.mts develop --dry-run',
        cache: false,
      },
      'check': { command: 'vp check', cache: { output: [] } },
      'dev': { command: 'vp run mobile#dev', cache: false },
      'dev:web': { command: 'vp run mobile#dev:web', cache: false },
      'lib-build': { command: 'node -e ""', dependsOn: ['build:packages'], cache: { output: [] } },
      'build:packages': { command: 'vp run -r build', cache: { output: [] } },
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
        cache: { output: ['coverage/**'] },
      },
      'typecheck': {
        command: 'vp run -r typecheck',
        dependsOn: ['lib-build'],
        cache: { output: [] },
      },
      'vp:install': { command: 'vp install', cache: false },
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
        'packages/client/app/core/lib/**/*.ts',
        'packages/client/app/mobile/src/**/*.{ts,tsx}',
        'packages/client/app/desktop/src/**/*.{ts,tsx}',
        // Declarative route views are exercised through component tests, while the unit coverage
        // gate measures independent application logic and the stateful SFCs mounted by this suite.
        'packages/client/app/mobile/src/{App,AppSetup}.vue',
        'packages/client/app/mobile/src/components/{listSearcher,home/mainPageSearchBar}.vue',
        'packages/client/app/mobile/src/components/plugin/marketplace/{PluginMarketplaceCard,PluginMarketplaceFilters}.vue',
        'packages/client/data/db/lib/**/*.ts',
        'packages/client/platform/downloader/lib/**/*.ts',
        'packages/client/platform/http/src-web/**/*.ts',
        'packages/shared/core/logger/lib/**/*.ts',
        'packages/client/core/model/lib/**/*.ts',
        'packages/client/core/plugin/{lib,vite}/**/*.ts',
        'packages/server/core/server/{app,lib}/**/*.ts',
        'packages/server/admin/panel/src/**/*.{ts,tsx,vue}',
        'packages/client/ui/ui/{lib,vite}/**/*.{ts,tsx,vue}',
        'packages/client/core/utils/{lib,vite}/**/*.ts',
      ],
      exclude: [
        '**/*.{test,spec}.{ts,tsx,mts}',
        '**/*.d.ts',
        '**/*.types.ts',
        '**/{test,__tests__}/**',
        'packages/client/app/mobile/src/icons.tsx',
        'packages/client/app/mobile/src/i18n/locales/schema.ts',
        'packages/client/app/mobile/src/main.tsx',
        'packages/server/core/server/app/index.ts',
        'packages/server/admin/panel/src/main.ts',
        'packages/server/admin/panel/src/shared/{api,components}/types.ts',
        'packages/client/ui/ui/lib/components/form/type.ts',
      ],
      thresholds: { lines: 50, functions: 50, branches: 45, statements: 45 },
    },
    exclude: ['**/node_modules/**', '**/.git/**', '.agents/**'],
    projects: [
      { test: { name: 'root', environment: 'node', include: ['script/test/**/*.test.ts'] } },
      'packages/shared/core/both',
      'packages/client/core/plugin-artifact',
      'packages/client/core/plugin-install',
      'packages/client/core/plugin-vite',
      'packages/shared/plugin/manifest',
      'packages/client/core/sdk',
      'packages/client/app/mobile',
      'packages/client/app/desktop',
      'packages/client/app/core',
      'packages/client/data/db',
      'packages/client/platform/downloader',
      'packages/client/platform/http',
      'packages/shared/core/logger',
      'packages/client/core/model',
      'packages/client/core/plugin',
      'packages/server/core/server',
      'packages/server/admin/panel',
      'packages/client/ui/ui',
      'packages/client/core/utils',
    ],
  },
})