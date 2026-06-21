import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { extendsDepends } from '@delta-comic/utils/vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import browserslist from 'browserslist'
import { browserslistToTargets } from 'lightningcss'
import { dts } from 'rolldown-plugin-dts'
import type { UserConfig } from 'vite-plus'
import { defineConfig } from 'vite-plus'
import VueRouter from 'vue-router/vite'

const externalDepends = [...Object.keys(extendsDepends), 'highlight.js']
const isExternal = (id: string) =>
  externalDepends.some(dep => id === dep || id.startsWith(`${dep}/`))

export default defineConfig(({ command }) => ({
  plugins: [
    VueRouter({ dts: false }),
    vue(),
    vueJsx(),
    tailwindcss(),
    ...(command === 'build'
      ? [
          dts({
            vue: true,
            tsconfig: resolve(import.meta.dirname, './tsconfig.app.json'),
            sourcemap: true,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./lib', import.meta.url)) },
    extensions: ['.ts', '.tsx', '.json', '.mjs', '.js', '.jsx', '.mts'],
  },
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      targets: browserslistToTargets(browserslist('> 1%, last 2 versions, not ie <= 8')),
    },
  },
  base: '/',
  oxc: { exclude: [/\.js$/, /\.d\.[cm]?ts$/] },
  server: {},
  // builds
  build: {
    lib: { entry: 'lib/index.ts', fileName: 'index', formats: ['es'] },
    sourcemap: true,
    rolldownOptions: {
      external: isExternal,
      output: {
        entryFileNames: chunk =>
          chunk.name.endsWith('.d') ? `${chunk.name.slice(0, -2)}.d.ts` : `${chunk.name}.js`,
        globals: extendsDepends,
      },
    },
  },
  pack: {
    entry: './vite/index.ts',
    outDir: 'dist-vite',
    dts: { oxc: true },
    sourcemap: true,
    deps: { neverBundle: ['unplugin-vue-components'] },
  },
})) as UserConfig