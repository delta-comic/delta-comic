import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import browserslist from 'browserslist'
import { browserslistToTargets } from 'lightningcss'
import type { UserConfig } from 'vite-plus'
import { defineConfig, lazyPlugins } from 'vite-plus'

const host = process.env.TAURI_DEV_HOST
// Release CI builds the workspace libraries and the shared runtime once in the `plan` job and
// downloads the artifacts into place; skip rebuilding them on each platform runner.
const skipLibBuild = process.env.DELTA_SKIP_LIB_BUILD === 'true'

export default defineConfig(
  () =>
    ({
      plugins: lazyPlugins(async () => {
        const [
          { exposeHostLibraries },
          { default: tailwindcss },
          { default: legacy },
          { default: vue },
          { default: vueJsx },
          { default: MotionResolver },
          { NaiveUiResolver },
          { default: Components },
          { default: vueDevTools },
          { default: wasm },
          { default: VueRouter },
          { DeltaComicUiResolver },
        ] = await Promise.all([
          import('@delta-comic/utils/vite'),
          import('@tailwindcss/vite'),
          import('@vitejs/plugin-legacy'),
          import('@vitejs/plugin-vue'),
          import('@vitejs/plugin-vue-jsx'),
          import('motion-v/resolver'),
          import('unplugin-vue-components/resolvers'),
          import('unplugin-vue-components/vite'),
          import('vite-plugin-vue-devtools'),
          import('vite-plugin-wasm'),
          import('vue-router/vite'),
          import('@delta-comic/ui/vite'),
        ])

        return [
          // @ts-ignore
          wasm(),
          legacy({ targets: ['ie >= 11'], renderModernChunks: false }),
          VueRouter({ dts: 'typed-router.d.ts' }),
          vueDevTools(),
          vue({
            template: { compilerOptions: { isCustomElement: tag => tag.startsWith('media-') } },
          }),
          vueJsx(),
          Components({
            dts: true,
            resolvers: [MotionResolver(), NaiveUiResolver(), DeltaComicUiResolver()],
            dtsTsx: false,
          }),
          tailwindcss(),
          exposeHostLibraries({ entry: fileURLToPath(new URL('./src/main.tsx', import.meta.url)) }),
        ]
      }),
      resolve: {
        alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
        extensions: ['.ts', '.tsx', '.json', '.mjs', '.js', '.jsx', '.mts'],
      },
      css: {
        transformer: 'lightningcss',
        lightningcss: { targets: browserslistToTargets(browserslist('> 5%')) },
      },
      build: {
        // Tauri uses Chromium on Windows and WebKit on macOS and Linux
        target: process.env.TAURI_ENV_PLATFORM == 'windows' ? 'chrome105' : 'safari15',
        // don't minify for debug builds
        minify: !process.env.TAURI_ENV_DEBUG ? 'oxc' : false,
        // produce sourcemaps for debug builds
        sourcemap: !!process.env.TAURI_ENV_DEBUG,
        rolldownOptions: {
          input: {
            main: resolve(import.meta.dirname, 'main.html'),
            splash: resolve(import.meta.dirname, 'index.html'),
          },
        },
      },
      worker: { format: 'es' },
      base: '/',
      server: {
        port: 5173,
        // Tauri expects a fixed port, fail if that port is not available
        strictPort: true,
        // if the host Tauri is expecting is set, use it
        host: host || false,
        hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,

        watch: {
          // tell vite to ignore watching `src-tauri`
          ignored: ['**/src-tauri/**', 'src-tauri'],
        },
      },
      test: {
        environment: 'happy-dom',
        include: ['test/**/*.test.ts'],
        setupFiles: ['./test/setup.ts'],
      },
      run: {
        tasks: {
          'build': {
            command: 'node -e ""',
            dependsOn: skipLibBuild
              ? []
              : [{ task: 'build', from: ['dependencies', 'devDependencies'] }],
            output: [],
          },
          'build:app': { command: 'TRUE_BUILD_MAIN_APP=true tauri android build', cache: false },
          'build:debug': { command: 'tauri android build --debug', cache: false },
          'build:local': { command: 'tauri build --debug', cache: false },
          'build:web': {
            command: 'vp build',
            dependsOn: skipLibBuild
              ? []
              : [{ task: 'build', from: 'dependencies' }, '@delta-comic/runtime#build'],
            output: ['dist/**'],
          },
          'dev': { command: 'tauri dev', cache: false },
          'dev:web': {
            command: 'vp dev',
            cache: false,
            dependsOn: [{ task: 'build', from: 'dependencies' }, '@delta-comic/runtime#build:dev'],
          },
          'tauri': { command: 'vp exec tauri', cache: false },
          'typecheck': {
            command: [
              'vue-tsc -p tsconfig.app.json --noEmit',
              'tsc -p tsconfig.node.json --noEmit',
            ],
            dependsOn: [{ task: 'build', from: 'dependencies' }],
            output: [],
          },
        },
      },
      clearScreen: false,
      envPrefix: ['VITE_', 'TAURI_ENV_*'],
    }) as UserConfig,
)