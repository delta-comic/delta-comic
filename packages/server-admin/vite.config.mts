import { fileURLToPath, URL } from 'node:url'

import type { UserConfig } from 'vite-plus'
import { defineConfig, lazyPlugins } from 'vite-plus'

export default defineConfig({
  plugins: lazyPlugins((async () => {
    const [
      { default: tailwindcss },
      { default: vue },
      { default: vueJsx },
      { NaiveUiResolver, VantResolver },
      { default: Components },
      { default: vueDevTools },
    ] = await Promise.all([
      import('@tailwindcss/vite'),
      import('@vitejs/plugin-vue'),
      import('@vitejs/plugin-vue-jsx'),
      import('unplugin-vue-components/resolvers'),
      import('unplugin-vue-components/vite'),
      import('vite-plugin-vue-devtools'),
    ])
    return [
      vueDevTools(),
      vue(),
      vueJsx(),
      Components({
        dts: true,
        dtsTsx: false,
        resolvers: [NaiveUiResolver(), VantResolver()],
      }),
      tailwindcss(),
    ]
  }) as any),
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    extensions: ['.ts', '.tsx', '.json', '.mjs', '.js', '.jsx', '.mts', '.vue'],
  },
  css: { transformer: 'lightningcss' },
  build: { outDir: 'dist', target: 'es2022', minify: 'oxc' },
  server: { port: 5174, strictPort: true },
} as UserConfig)
