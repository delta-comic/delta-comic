import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite-plus'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  pack: {
    entry: ['./lib/index.ts', './vite/index.ts'],
    alias: { '@': './lib' },
    dts: { tsconfig: './tsconfig.app.json' },
    sourcemap: true,
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./lib', import.meta.url)) } },
  root,
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
})