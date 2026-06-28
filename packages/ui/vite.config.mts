import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import browserslist from 'browserslist'
import { browserslistToTargets } from 'lightningcss'
import type { UserConfig } from 'vite-plus'
import { defineConfig, lazyPlugins } from 'vite-plus'

const extendsDepends = await (async () => {
  try {
    const { extendsDepends } = await import('@delta-comic/utils/vite')
    return extendsDepends
  } catch (error) {
    console.warn(error, 'Fail to import `@delta-comic/utils/vite`')
    return {}
  }
})()
const externalDepends = [...Object.keys(extendsDepends), 'highlight.js']
const isExternal = (id: string) =>
  externalDepends.some(dep => id === dep || id.startsWith(`${dep}/`))

export default defineConfig(({ command }) => ({
  plugins: lazyPlugins(async () => {
    const [
      { default: tailwindcss },
      { default: vue },
      { default: vueJsx },
      { dts },
      { default: VueRouter },
    ] = await Promise.all([
      import('@tailwindcss/vite'),
      import('@vitejs/plugin-vue'),
      import('@vitejs/plugin-vue-jsx'),
      import('rolldown-plugin-dts'),
      import('vue-router/vite'),
    ])

    return [
      VueRouter({ dts: 'typed-router.d.ts' }),
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
    ]
  }),
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