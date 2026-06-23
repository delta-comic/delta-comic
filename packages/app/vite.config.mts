import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import browserslist from 'browserslist'
import { browserslistToTargets } from 'lightningcss'
import MotionResolver from 'motion-v/resolver'
import { NaiveUiResolver, VantResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import vueDevTools from 'vite-plugin-vue-devtools'
import wasm from 'vite-plugin-wasm'
import type { UserConfig } from 'vite-plus'
import { defineConfig } from 'vite-plus'
import VueRouter from 'vue-router/vite'

const host = process.env.TAURI_DEV_HOST

export default defineConfig(
  async () =>
    ({
      plugins: [
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
            ...(await (async () => {
              try {
                const { DeltaComicUiResolver } = await import('@delta-comic/ui/vite')
                return [DeltaComicUiResolver()]
              } catch (error) {
                console.warn(error, 'Fail to import `@delta-comic/ui/vite`')
                return []
              }
            })()),
          ],
          dtsTsx: false,
        }),
        tailwindcss(),
      ],
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