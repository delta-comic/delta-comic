import { relative, resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from '@vizejs/vite-plugin/vite-plus'
import browserslist from 'browserslist'
import { browserslistToTargets } from 'lightningcss'
import { defaultClientConditions, lazyPlugins } from 'vite-plus'

const target = process.env.DELTA_APP_TARGET === 'mobile' ? 'mobile' : 'desktop'
const isDesktop = target === 'desktop'

export default defineConfig(() => ({
  define: { __DC_APP_TARGET__: JSON.stringify(target) },
  devtools: { apply: 'serve' },
  plugins: lazyPlugins(async () => {
    const [
      { default: tailwindcss },
      { default: legacy },
      { default: vueDevTools },
      { default: VueRouter },
      { default: swc },
    ] = await Promise.all([
      import('@tailwindcss/vite'),
      import('@vitejs/plugin-legacy'),
      import('vite-plugin-vue-devtools'),
      import('vue-router/vite'),
      import('unplugin-swc'),
    ])

    return [
      swc.vite({
        tsconfigFile: 'tsconfig.json',
        jsc: {
          externalHelpers: true,
          parser: { syntax: 'typescript', tsx: true, decorators: true },
          transform: { decoratorVersion: '2023-11', useDefineForClassFields: true },
        },
      }),
      legacy({ targets: ['ie >= 11'], renderModernChunks: true }),
      VueRouter({
        root: import.meta.dirname,
        routesFolder: {
          src: 'src/pages',
          path: file =>
            relative(resolve(import.meta.dirname, 'src/pages'), file)
              .replaceAll('\\', '/')
              .replace(/\/index\.vue$/, '.vue'),
        },
        dts: resolve(import.meta.dirname, 'typed-router.d.ts'),
        exclude: ['**/components/**', '**/*.impl.vue', '**/*.desktop.vue', '**/*.mobile.vue'],
        // `index.vue` directories keep the existing route names used by the app.
        getRouteName: node => {
          const segments: string[] = []
          let current = node
          while (current.parent) {
            const segment = current.value.rawSegment
            if (segment !== 'index' && !/^\(.+\)$/.test(segment)) segments.unshift(segment)
            current = current.parent
          }
          return segments.length ? `/${segments.join('/')}` : '/'
        },
      }),
      vueDevTools(),
      tailwindcss(),
    ]
  }),

  resolve: {
    conditions: ['delta-comic-workspace', ...defaultClientConditions],
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    extensions: ['.ts', '.tsx', '.json', '.mjs', '.js', '.jsx', '.mts'],
  },
  css: {
    transformer: 'lightningcss',
    lightningcss: { targets: browserslistToTargets(browserslist('> 5%')) },
  },
  build: {
    target: process.env.TAURI_ENV_PLATFORM == 'windows' ? 'chrome105' : 'safari15',
    minify: !process.env.TAURI_ENV_DEBUG ? 'oxc' : false,
    sourcemap: true,
    rolldownOptions: { input: { main: resolve(import.meta.dirname, 'index.html') } },
  },
  worker: { format: 'es' },
  base: '/',
  test: {
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
  },
  server: {
    port: 5173,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST,
    hmr: { protocol: 'ws', host: process.env.TAURI_DEV_HOST, port: 1421 },
    watch: { ignored: ['**/src-tauri/**', 'src-tauri'] },
  },
  run: {
    tasks: {
      'build:app': {
        command: isDesktop
          ? 'DELTA_APP_TARGET=desktop tauri build --config src-tauri/tauri.conf.json'
          : 'DELTA_APP_TARGET=mobile TRUE_BUILD_MAIN_APP=true tauri android build --config src-tauri/tauri.conf.json',
        cache: false,
      },
      'build:debug': {
        command: isDesktop
          ? 'DELTA_APP_TARGET=desktop tauri build --debug --config src-tauri/tauri.conf.json'
          : 'DELTA_APP_TARGET=mobile tauri android build --debug --config src-tauri/tauri.conf.json',
        cache: false,
      },
      'build:local': {
        command: 'DELTA_APP_TARGET=desktop tauri build --debug --config src-tauri/tauri.conf.json',
        cache: false,
      },
      // dev
      'dev': {
        command: isDesktop
          ? 'DELTA_APP_TARGET=desktop tauri dev --config src-tauri/tauri.conf.json'
          : 'DELTA_APP_TARGET=mobile tauri android dev --config src-tauri/tauri.conf.json',
        cache: false,
      },
      // dev/tauri
      'dev:desktop': {
        command: 'DELTA_APP_TARGET=desktop tauri dev --config src-tauri/tauri.conf.json',
        cache: false,
      },
      'dev:mobile': {
        command: 'DELTA_APP_TARGET=mobile tauri android dev --config src-tauri/tauri.conf.json',
        cache: false,
      },
      // dev/tauri/web
      'dev:web': {
        command: 'vp dev',
        cache: false,
        dependsOn: [{ task: 'build', from: 'dependencies' }],
      },
      //
      'tauri': { command: 'vp exec tauri', cache: false },
      'typecheck': {
        command: [
          'tsrs --fast --runExternalCode --noEmit -p tsconfig.app.json',
          'tsrs --fast --runExternalCode -p tsconfig.node.json --noEmit',
        ],
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        cache: { output: [] },
      },
    },
  },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
})).withVue({})