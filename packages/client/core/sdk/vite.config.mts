import { fileURLToPath, URL } from 'node:url'

import { transform } from '@swc/core'
import { defineConfig } from 'vite-plus'
import type { Plugin } from 'vite-plus'

const lowerDecorators = async (code: string, id: string) => {
  if (!/\.[cm]?tsx?$/.test(id) || id.includes('node_modules')) return
  const result = await transform(code, {
    filename: id,
    sourceMaps: true,
    jsc: {
      target: 'es2022',
      parser: { syntax: 'typescript', decorators: true },
      transform: { decoratorVersion: '2023-11', legacyDecorator: false, decoratorMetadata: false },
    },
  })
  return { code: result.code, map: result.map }
}

const decoratorPlugin: Plugin = { name: 'delta-comic:lower-decorators', transform: lowerDecorators }

export default defineConfig({
  plugins: [decoratorPlugin],
  resolve: {
    alias: {
      '@delta-comic/client-data-db': fileURLToPath(
        new URL('../../data/db/lib/index.ts', import.meta.url),
      ),
      '@delta-comic/client-platform-downloader': fileURLToPath(
        new URL('../../platform/downloader/lib/index.ts', import.meta.url),
      ),
      '@delta-comic/shared-core-logger': fileURLToPath(
        new URL('../../../shared/core/logger/lib/index.ts', import.meta.url),
      ),
      '@delta-comic/client-core-model': fileURLToPath(
        new URL('../model/lib/index.ts', import.meta.url),
      ),
      '@delta-comic/shared-plugin-manifest': fileURLToPath(
        new URL('../../../shared/plugin/manifest/lib/index.ts', import.meta.url),
      ),
      '@delta-comic/client-ui-ui': fileURLToPath(
        new URL('../../ui/ui/lib/index.ts', import.meta.url),
      ),
      '@delta-comic/client-core-utils': fileURLToPath(
        new URL('../utils/lib/index.ts', import.meta.url),
      ),
    },
  },
  pack: {
    entry: [
      './lib/index.ts',
      './lib/manifest.ts',
      './lib/ui.ts',
      './lib/network.ts',
      './lib/diagnostics.ts',
    ],
    sourcemap: true,
    dts: { tsconfig: './tsconfig.json' },
    deps: {
      alwaysBundle: [/^@delta-comic\//],
      dts: { alwaysBundle: id => id.startsWith('@delta-comic/') || id.includes('/packages/') },
    },
    plugins: [decoratorPlugin],
  },
  run: {
    tasks: {
      build: {
        command: 'vp pack',
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        cache: { output: ['dist/**'] },
      },
      typecheck: {
        command: ['tsc -p tsconfig.json --noEmit'],
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        cache: { output: [] },
      },
    },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
})