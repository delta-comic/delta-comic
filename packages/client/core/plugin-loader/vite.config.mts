import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: { entry: './lib/index.ts', dts: true, sourcemap: true },
  run: {
    tasks: {
      build: { command: 'vp pack', output: ['dist/**'] },
      typecheck: { command: 'tsc -p tsconfig.json --noEmit', output: [] },
    },
  },
  test: { name: 'plugin-loader', environment: 'node', include: ['test/**/*.test.ts'] },
})