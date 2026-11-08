import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: { entry: './lib/index.ts', dts: true, sourcemap: true },
  run: {
    tasks: {
      build: { command: 'vp pack', cache: { output: ['dist/**'] } },
      typecheck: {
        command: 'tsrs --fast --runExternalCode -p tsconfig.json --noEmit',
        cache: { output: [] },
      },
    },
  },
  test: {
    name: '@delta-comic/client-plugin-vite',
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})