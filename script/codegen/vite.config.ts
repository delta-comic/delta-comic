import { defineConfig } from '@vizejs/vite-plugin/vite-plus'

export default defineConfig({
  pack: { entry: ['./src/cli.ts', './src/index.ts'], format: 'esm', sourcemap: true, dts: true },
  run: {
    tasks: {
      build: { command: 'vp pack', cache: { output: ['dist/**'] } },
      typecheck: {
        command: 'tsrs --fast --runExternalCode -p tsconfig.json',
        cache: { output: [] },
      },
    },
  },
}).withVue({})