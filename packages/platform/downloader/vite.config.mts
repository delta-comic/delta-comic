import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite-plus'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  pack: { dts: { tsconfig: './tsconfig.app.json' }, sourcemap: true, entry: './lib/index.ts' },
  root,
  run: {
    tasks: {
      build: { command: 'vp pack', cache: { output: ['dist/**'] } },
      typecheck: {
        command: [
          'tsrs --fast --runExternalCode -p tsconfig.app.json --noEmit',
          'tsrs --fast --runExternalCode -p tsconfig.node.json --noEmit',
        ],
        cache: { output: [] },
      },
    },
  },
})