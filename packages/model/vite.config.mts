import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite-plus'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  pack: { entry: './lib/index.ts', dts: { tsconfig: './tsconfig.app.json' } },
  root,
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
})