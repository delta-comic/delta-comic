import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: { entry: './lib/index.ts', dts: true, sourcemap: true },
  run: {
    tasks: {
      build: { command: 'vp pack', cache: { output: ['dist/**'] } },
      typecheck: { command: 'tsc -p tsconfig.json --noEmit', cache: { output: [] } },
    },
  },
  test: {
    name: '@delta-comic/plugin-install',
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})