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
    exclude: ['**/node_modules/**', '**/.git/**', '.agents/**'],
    projects: [
      { test: { name: 'root', environment: 'node', include: ['script/**/*.test.ts'] } },
      'packages/db',
      'packages/model',
      'packages/plugin',
      'packages/server',
      'packages/server-admin',
      'packages/utils',
    ],
  },
})