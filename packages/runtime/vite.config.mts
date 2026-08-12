import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite-plus'

const root = fileURLToPath(new URL('.', import.meta.url))
const output = fileURLToPath(new URL('../app/public/runtime', import.meta.url))

export default defineConfig(({ mode }) => {
  const isDevelopment = mode === 'development'

  return {
    root,
    run: {
      tasks: {
        'build': {
          command: 'vp build',
          output: [{ pattern: 'packages/app/public/runtime/**', base: 'workspace' }],
        },
        'build:dev': {
          command: 'vp build --mode development',
          output: [{ pattern: 'packages/app/public/runtime/**', base: 'workspace' }],
        },
        'typecheck': { command: 'tsc -p tsconfig.json --noEmit', output: [] },
      },
    },
    plugins: [
      {
        name: 'delta-comic:validate-single-umd',
        generateBundle(_options, bundle) {
          const outputs = Object.values(bundle)
          const chunks = outputs.filter(output => output.type === 'chunk')
          const assets = outputs.filter(output => output.type === 'asset')
          const chunk = chunks[0]
          const vueRuntimeModules = [...this.getModuleIds()].filter(id =>
            /\/node_modules\/vue\/dist\/vue\.runtime\.esm-bundler\.js(?:\?|$)/.test(
              id.replaceAll('\\', '/'),
            ),
          )

          if (chunks.length !== 1 || assets.length !== 0 || !chunk) {
            throw new Error(
              `[delta-comic] Shared runtime must contain exactly one UMD chunk and no assets (received ${chunks.length} chunks and ${assets.length} assets).`,
            )
          }
          if (chunk.imports.length > 0 || chunk.dynamicImports.length > 0) {
            throw new Error('[delta-comic] Shared runtime UMD must not contain external imports.')
          }
          if (vueRuntimeModules.length !== 1) {
            throw new Error(
              `[delta-comic] Shared runtime must contain exactly one Vue runtime (received ${vueRuntimeModules.length}).`,
            )
          }
          if (
            !isDevelopment &&
            (chunk.code.includes('import.meta') ||
              chunk.code.includes('process.env.NODE_ENV') ||
              /__VUE_(?:OPTIONS_API|PROD_DEVTOOLS|PROD_HYDRATION_MISMATCH_DETAILS)__/.test(
                chunk.code,
              ))
          ) {
            throw new Error('[delta-comic] Shared runtime UMD contains unresolved runtime syntax.')
          }
        },
      },
    ],
    define: {
      '__VUE_OPTIONS_API__': 'true',
      '__VUE_PROD_DEVTOOLS__': 'false',
      '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false',
      'process.env.NODE_ENV': JSON.stringify(isDevelopment ? 'development' : 'production'),
    },
    resolve: { dedupe: ['vue', 'vue-router', 'pinia', '@pinia/colada', 'naive-ui'] },
    build: {
      assetsInlineLimit: Number.POSITIVE_INFINITY,
      cssCodeSplit: false,
      emptyOutDir: true,
      lib: {
        entry: fileURLToPath(new URL('./lib/index.ts', import.meta.url)),
        fileName: () => 'host-libraries.umd.js',
        formats: ['umd'],
        name: 'DeltaComicHostLibraries',
      },
      minify: isDevelopment ? false : 'oxc',
      outDir: output,
      rolldownOptions: { output: { exports: 'named' } },
      sourcemap: false,
      target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari15',
    },
  }
})