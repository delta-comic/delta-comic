import { fileURLToPath, URL } from 'node:url'

import browserslist from 'browserslist'
import { browserslistToTargets } from 'lightningcss'
import type { UserConfig } from 'vite-plus'
import { defineConfig, lazyPlugins } from 'vite-plus'

const host = process.env.TAURI_DEV_HOST

export default defineConfig(
  () =>
    ({
      plugins: lazyPlugins(async () => {
        const [
          { default: tailwindcss },
          { default: vue },
          { default: vueJsx },
          { default: MotionResolver },
          { NaiveUiResolver, VantResolver },
          { default: Components },
          { default: vueDevTools },
          { default: wasm },
          { default: VueRouter },
        ] = await Promise.all([
          import('@tailwindcss/vite'),
          import('@vitejs/plugin-vue'),
          import('@vitejs/plugin-vue-jsx'),
          import('motion-v/resolver'),
          import('unplugin-vue-components/resolvers'),
          import('unplugin-vue-components/vite'),
          import('vite-plugin-vue-devtools'),
          import('vite-plugin-wasm'),
          import('vue-router/vite'),
        ])
        const deltaComicUiResolvers = await (async () => {
          try {
            const { DeltaComicUiResolver } = await import('@delta-comic/ui/vite')
            return [DeltaComicUiResolver()]
          } catch (error) {
            console.warn(error, 'Fail to import `@delta-comic/ui/vite`')
            return []
          }
        })()

        return [
          // @ts-ignore
          wasm(),
          VueRouter({ dts: 'typed-router.d.ts' }),
          vueDevTools(),
          vue({
            template: { compilerOptions: { isCustomElement: tag => tag.startsWith('media-') } },
          }),
          vueJsx(),
          Components({
            dts: true,
            resolvers: [
              VantResolver(),
              MotionResolver(),
              NaiveUiResolver(),
              ...deltaComicUiResolvers,
            ],
            dtsTsx: false,
          }),
          tailwindcss(),
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
      },
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
      clearScreen: false,
      envPrefix: ['VITE_', 'TAURI_ENV_*'],
    }) as UserConfig,
)