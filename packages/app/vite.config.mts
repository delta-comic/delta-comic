import { fileURLToPath, URL } from 'node:url'

import { DeltaComicUiResolver } from '@delta-comic/ui/vite'
import MotionResolver from 'motion-v/resolver'
import { NaiveUiResolver, VantResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
import MsClarity from 'vite-plugin-ms-clarity'
import vueDevTools from 'vite-plugin-vue-devtools'
import VueRouter from 'vue-router/vite'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [
    VueRouter({ dts: 'typed-router.d.ts' }),
    vueDevTools(),
    MsClarity({ id: 'v2xgbuugti', enableInDevMode: false }),
    Components({
      dts: true,
      resolvers: [VantResolver(), MotionResolver(), NaiveUiResolver(), DeltaComicUiResolver()],
      dtsTsx: false
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: process.env.TAURI_ENV_PLATFORM == 'windows' ? 'chrome105' : 'safari15',
    // don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? 'oxc' : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG
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
      ignored: ['**/src-tauri/**']
    }
  }
} as UserConfig)