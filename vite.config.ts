import { defineConfig } from 'vite-plus'
import type { OxfmtConfig } from 'vite-plus/fmt'
import type { OxlintConfig } from 'vite-plus/lint'

import fmt from './.oxfmtrc.json' with { type: 'json' }
import lint from './.oxlintrc.json' with { type: 'json' }

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
    '*.{md,json,toml,rs,js,jsx,ts,tsx,mts,cts,mjs,cjs,vue,html}':
      'vp exec cspell --no-must-find-files',
  },
  fmt: fmt as OxfmtConfig,
  lint: lint as OxlintConfig,
  run: { cache: { tasks: true, scripts: true } },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'script/**/*.{ts,mts}',
        'packages/app/src/**/*.{ts,tsx,vue}',
        'packages/db/lib/**/*.ts',
        'packages/model/lib/**/*.ts',
        'packages/plugin/{lib,vite}/**/*.ts',
        'packages/server/{app,lib}/**/*.ts',
        'packages/server-admin/src/**/*.{ts,tsx,vue}',
        'packages/server-config/lib/**/*.ts',
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
        'script/{release-notes,set-version,update-version,version-packages}.mts',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
    exclude: ['**/node_modules/**', '**/.git/**', '.agents/**'],
    projects: [
      { test: { name: 'root', environment: 'node', include: ['script/**/*.test.ts'] } },
      'packages/app',
      'packages/db',
      'packages/model',
      'packages/plugin',
      'packages/server',
      'packages/server-admin',
      'packages/ui',
      'packages/utils',
    ],
  },
})
