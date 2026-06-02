import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import browserslist from 'browserslist'
import { browserslistToTargets } from 'lightningcss'
import MotionResolver from 'motion-v/resolver'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import dtsPlugin from 'vite-plugin-dts'
import { defineConfig, type UserConfig } from 'vite-plus'

export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    Components({ dts: true, resolvers: [MotionResolver(), NaiveUiResolver()] }) as any,
    tailwindcss(),
    dtsPlugin({
      processor: 'vue',
      include: ['env.d.ts', 'components.d.ts', 'lib/**/*.ts', 'lib/**/*.tsx', 'lib/**/*.vue'],
      entryRoot: 'lib',
      tsconfigPath: './tsconfig.app.json',
      cleanVueFileName: true,
      bundleTypes: true,
    }),
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
  // builds
  build: { lib: { entry: 'lib/index.ts', fileName: 'index', formats: ['es'] }, sourcemap: true },
  pack: {
    entry: './vite/index.ts',
    outDir: 'dist-vite',
    dts: { oxc: true },
    sourcemap: true,
    deps: { neverBundle: ['unplugin-vue-components'] },
  },
}) as UserConfig