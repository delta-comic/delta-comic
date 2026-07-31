import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    entry: ['./lib/index.ts', './vite/index.ts'],
    sourcemap: true,
    dts: { tsgo: true, tsconfig: './tsconfig.app.json' },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
})