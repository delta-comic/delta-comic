import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import browserslist from 'browserslist'
import { browserslistToTargets } from 'lightningcss'
import type { UserConfig } from 'vite-plus'
import { defineConfig, lazyPlugins } from 'vite-plus'

const extendsDepends = await (async () => {
  try {
    const { extendsDepends } = await import('@delta-comic/client-utils/vite')
    return extendsDepends
  } catch (error) {
    console.warn(error, 'Fail to import `@delta-comic/client-utils/vite`')
    return {}
  }
})()
const externalDepends = [...Object.keys(extendsDepends), 'highlight.js']
const isExternal = (id: string) =>
  id.startsWith('@delta-comic/') ||
  externalDepends.some(dep => id === dep || id.startsWith(`${dep}/`))

export default defineConfig(({ command }) => ({
  plugins: lazyPlugins((async () => {
    const [{ default: tailwindcss }, { default: vize }, { dts }, { default: VueRouter }] =
      await Promise.all([
        import('@tailwindcss/vite'),
        import('@vizejs/vite-plugin'),
        import('rolldown-plugin-dts'),
        import('vue-router/vite'),
      ])

    return [
      VueRouter({
        root: import.meta.dirname,
        dts: resolve(import.meta.dirname, 'typed-router.d.ts'),
      }),
      vize({ jsxMode: 'vdom' }),
      tailwindcss(),
      ...(command === 'build'
        ? [
            dts({
              tsconfig: resolve(import.meta.dirname, './tsconfig.build.json'),
              ...(process.platform === 'win32' ? { generator: 'oxc' } : { tsc: { vue: true } }),
              sourcemap: true,
            }),
          ]
        : []),
    ]
  }) as any),
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
  pack: {
    entry: './vite/index.ts',
    outDir: 'dist-vite',
    dts: { generator: 'oxc', oxc: {}, tsconfig: './tsconfig.node.json' },
    sourcemap: true,
    deps: { neverBundle: ['unplugin-vue-components'] },
  },
  run: {
    tasks: {
      build: {
        command: ['vp build', 'vp pack'],
        dependsOn: [{ task: 'build', from: ['dependencies', 'peerDependencies'] }],
        cache: { output: ['dist/**', 'dist-vite/**'] },
      },
      dev: { command: 'vp dev', cache: false },
      typecheck: {
        command: [
          'tsrs --runExternalCode --noEmit -p tsconfig.app.json',
          'tsc -p tsconfig.node.json --noEmit',
        ],
        dependsOn: [{ task: 'build', from: ['dependencies', 'peerDependencies'] }],
        cache: { output: [] },
      },
    },
  },
})) as UserConfig