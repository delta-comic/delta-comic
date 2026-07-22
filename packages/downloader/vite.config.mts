import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite-plus'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  pack: {
    dts: { tsgo: true, tsconfig: './tsconfig.app.json' },
    sourcemap: true,
    entry: './lib/index.ts',
  },
  root,
  test: { environment: 'node', include: ['lib/**/*.test.ts'] },
})