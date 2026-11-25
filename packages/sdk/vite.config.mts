import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from '@vizejs/vite-plugin/vite-plus'
import swc from 'unplugin-swc'

export default defineConfig({
  plugins: [
    swc.rolldown({
      tsconfigFile: 'tsconfig.json',
      jsc: {
        externalHelpers: true,
        parser: { syntax: 'typescript', tsx: true, decorators: true },
        transform: { decoratorVersion: '2023-11', useDefineForClassFields: true },
      },
    }),
  ],
  resolve: {
    alias: {
      '@delta-comic/db': fileURLToPath(new URL('../../platform/db/lib/index.ts', import.meta.url)),
      '@delta-comic/downloader': fileURLToPath(
        new URL('../../platform/downloader/lib/index.ts', import.meta.url),
      ),
      '@delta-comic/logger': fileURLToPath(new URL('../logger/lib/index.ts', import.meta.url)),
      '@delta-comic/model': fileURLToPath(new URL('../model/lib/index.ts', import.meta.url)),
      '@delta-comic/manifest': fileURLToPath(
        new URL('../../plugin/manifest/lib/index.ts', import.meta.url),
      ),
      '@delta-comic/ui': fileURLToPath(new URL('../../ui/ui/lib/index.ts', import.meta.url)),
      '@delta-comic/utils': fileURLToPath(new URL('../utils/lib/index.ts', import.meta.url)),
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
        dts: { alwaysBundle: id => id.startsWith('@delta-comic/') || id.includes('/packages/') },
      },
    },
  ],
  run: {
    tasks: {
      build: {
        command: 'vp pack',
        dependsOn: [{ task: 'build', from: ['dependencies', 'devDependencies'] }],
        cache: { output: ['dist/**'] },
      },
      typecheck: {
        command: ['tsrs --fast --runExternalCode -p tsconfig.json --noEmit'],
        dependsOn: [{ task: 'build', from: ['dependencies', 'devDependencies'] }],
        cache: { output: [] },
      },
    },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
}).withVue({})