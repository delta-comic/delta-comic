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
      '@delta-comic/client-db': fileURLToPath(new URL('../db/lib/index.ts', import.meta.url)),
      '@delta-comic/client-downloader': fileURLToPath(
        new URL('../downloader/lib/index.ts', import.meta.url),
      ),
      '@delta-comic/logger': fileURLToPath(
        new URL('../../shared/logger/lib/index.ts', import.meta.url),
      ),
      '@delta-comic/client-model': fileURLToPath(new URL('../model/lib/index.ts', import.meta.url)),
      '@delta-comic/manifest': fileURLToPath(
        new URL('../../shared/manifest/lib/index.ts', import.meta.url),
      ),
      '@delta-comic/client-ui': fileURLToPath(new URL('../ui/lib/index.ts', import.meta.url)),
      '@delta-comic/client-utils': fileURLToPath(new URL('../utils/lib/index.ts', import.meta.url)),
    },
  },
  pack: [
    {
      entry: [
        './lib/index.ts',
        './lib/manifest.ts',
        './lib/ui.ts',
        './lib/network.ts',
        './lib/vite.ts',
      ],
      sourcemap: true,
      dts: {
        tsconfig: './tsconfig.json',
        resolver: 'tsc',
        compilerOptions: { stripInternal: true },
      },
      deps: {
        alwaysBundle: [/^@delta-comic\//],
        neverBundle: ['vite-plus'],
        dts: { alwaysBundle: id => id.startsWith('@delta-comic/') || id.includes('/packages/') },
      },
    },
  ],
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
})