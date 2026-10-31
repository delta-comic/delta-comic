import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    entry: ['./src/cli.ts', './src/index.ts'],
    format: 'esm',
    sourcemap: true,
    dts: true,
  },
  run: {
    tasks: {
      build: { command: 'vp pack', cache: { output: ['dist/**'] } },
      typecheck: { command: 'tsc -p tsconfig.json', cache: { output: [] } },
    },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
})