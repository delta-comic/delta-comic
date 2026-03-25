import { fileURLToPath, URL } from 'node:url'

import { extendsDepends } from '@delta-comic/utils'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import browserslist from 'browserslist'
import { browserslistToTargets } from 'lightningcss'
import dtsPlugin from 'vite-plugin-dts'
import { defineConfig } from 'vite-plus'

import _package from './package.json'

export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    dtsPlugin({ include: ['./lib'], tsconfigPath: './tsconfig.json' }),
    tailwindcss()
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./lib', import.meta.url)) },
    dedupe: ['vue', 'vue-router'],
    extensions: ['.ts', '.tsx', '.json', '.mjs', '.js', '.jsx', '.mts']
  },
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      targets: browserslistToTargets(browserslist('> 1%, last 2 versions, not ie <= 8'))
    }
  },
  build: {
    lib: { entry: ['./lib/index.ts'], name: 'DcPlugin', fileName: 'index', formats: ['es'] },
    sourcemap: true,
    rolldownOptions: {
      external: Object.keys(extendsDepends).concat(['lightningcss']),
      output: { globals: extendsDepends }
    }
  }
})