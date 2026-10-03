import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite-plus'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  pack: { dts: { tsconfig: './tsconfig.app.json' }, sourcemap: true, entry: './src-web/index.ts' },
  root,
  run: {
    tasks: {
      build: { command: 'vp pack', cache: { output: ['dist/**'] } },
      typecheck: {
        command: ['tsc -p tsconfig.app.json --noEmit', 'tsc -p tsconfig.node.json --noEmit'],
        cache: { output: [] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src-web/**/*.test.ts'],
    setupFiles: ['./src-web/test/setup.ts'],
  },
})