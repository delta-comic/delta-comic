import { defineConfig } from '@vizejs/vite-plugin/vite-plus'

export default defineConfig({
  pack: { entry: ['./lib/index.ts'], sourcemap: true, dts: { tsconfig: './tsconfig.json' } },
  run: {
    tasks: {
      build: { command: 'vp pack', cache: { output: ['dist/**'] } },
      typecheck: {
        command: 'tsrs --fast --runExternalCode -p tsconfig.json --noEmit',
        cache: { output: [] },
      },
    },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
}).withVue({})