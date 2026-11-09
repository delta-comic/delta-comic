import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from '@vizejs/vite-plugin/vite-plus'
import browserslist from 'browserslist'
import { browserslistToTargets } from 'lightningcss'
import { lazyPlugins } from 'vite-plus'

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
  id.startsWith('@delta-comic/') ||
  externalDepends.some(dep => id === dep || id.startsWith(`${dep}/`))

export default defineConfig(({ command }) => ({
  plugins: lazyPlugins(async () => {
    const [{ default: tailwindcss }, { dts }, { default: VueRouter }] = await Promise.all([
      import('@tailwindcss/vite'),
      import('rolldown-plugin-dts'),
      import('vue-router/vite'),
    ])

    return [
      VueRouter({
        root: import.meta.dirname,
        dts: resolve(import.meta.dirname, 'typed-router.d.ts'),
      }),

      tailwindcss(),
      ...(command === 'build'
        ? [
            dts({
              tsconfig: resolve(import.meta.dirname, './tsconfig.build.json'),
              ...(process.platform === 'win32'
                ? { generator: 'oxc' }
                : { tsrs: { runExternalCode: true } }),
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
  // builds
  build: {
    lib: {
      entry: { index: 'lib/index.ts', environment: 'lib/environment.ts' },
      formats: ['es'],
      cssFileName: 'index',
    },
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
  run: {
    tasks: {
      build: {
        command: ['vp build'],
        dependsOn: [{ task: 'build', from: ['dependencies', 'peerDependencies'] }],
        cache: { output: ['dist/**'] },
      },
      dev: { command: 'vp dev', cache: false },
      typecheck: {
        command: [
          'tsrs --fast --runExternalCode --noEmit -p tsconfig.app.json',
          'tsrs --fast --runExternalCode -p tsconfig.node.json --noEmit',
        ],
        cache: { output: [] },
      },
    },
  },
})).withVue({})