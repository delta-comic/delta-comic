import { defineConfig } from 'vite-plus'
import type { OxfmtConfig } from 'vite-plus/fmt'
import type { OxlintConfig } from 'vite-plus/lint'

import fmt from './.oxfmtrc.json' with { type: 'json' }
import lint from './.oxlintrc.json' with { type: 'json' }

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
    '*.{ts,tsx,mts,js,jsx,mjs,vue,html,md,json,yaml,toml}': 'vp exec cspell --no-must-find-files',
  },
  fmt: fmt as OxfmtConfig,
  lint: lint as OxlintConfig,
  run: { cache: { tasks: true, scripts: false } },
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
        'packages/app/src/components/{listSearcher,home/mainPageSearchBar,plugin/index,plugin/PrebootRecoveryAlert}.vue',
        'packages/app/src/components/plugin/marketplace/{PluginMarketplaceCard,PluginMarketplaceFilters}.vue',
        'packages/db/lib/**/*.ts',
        'packages/downloader/lib/**/*.ts',
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
      { test: { name: 'root', environment: 'node', include: ['script/**/*.test.ts'] } },
      'packages/app',
      'packages/db',
      'packages/downloader',
      'packages/model',
      'packages/plugin',
      'packages/server',
      'packages/server-admin',
      'packages/ui',
      'packages/utils',
    ],
  },
})