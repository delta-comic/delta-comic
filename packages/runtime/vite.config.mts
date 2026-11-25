import { defineConfig } from '@vizejs/vite-plugin/vite-plus'

export default defineConfig({
  run: {
    tasks: {
      build: { command: 'vp build', cache: true },
      typecheck: {
        command: 'tsrs --fast --runExternalCode -p tsconfig.json --noEmit',
        cache: { output: [] },
      },
    },
  },
  pack: {
    entry: './lib/index.ts',
    deps: {
      alwaysBundle: [
        'vue',
        'vue-router',
        'pinia',
        '@pinia/colada',
        'naive-ui',
        '@delta-comic/client',
      ],
    },
    css: { splitting: false },
    format: 'umd',
    sourcemap: true,
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari15',
  },
}).withVue({})