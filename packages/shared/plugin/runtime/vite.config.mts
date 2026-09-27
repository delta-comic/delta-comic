import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: { entry: './lib/index.ts', dts: true, sourcemap: true },
  run: {
    tasks: {
      build: { command: 'vp pack', output: ['dist/**'] },
      typecheck: { command: 'tsc -p tsconfig.typecheck.json --noEmit', output: [] },
    },
  },
  test: {
    name: '@delta-comic/plugin-runtime',
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
})